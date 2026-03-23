from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, FileResponse, Http404
import json
import requests
from django.db.models import Q, Count, Sum
from django.utils import timezone
from .models import User, Document,OTPVerification
import os
from django.views.decorators.http import require_POST
from .chatbot import chat as ai_chat, get_expiry_warnings
from .models import User, Document, ChatMessage
from django.core.mail import send_mail
from django.conf import settings

# ─────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────

def no_cache(response):
    response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response['Pragma']        = 'no-cache'
    response['Expires']       = '0'
    return response


# ─────────────────────────────────────────────
# PAGE VIEW  — welcome
# ─────────────────────────────────────────────

def page_view(request, page):
    templates = {
        'welcome': 'welcome.html',
    }
    template = templates.get(page)
    if not template:
        return redirect('welcome')
    return render(request, template)


# ─────────────────────────────────────────────
# REGISTER
# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
# REGISTER — Step 1: collect details, send OTP
# ─────────────────────────────────────────────

def register_view(request):
    if request.method == "POST":
        action = request.POST.get("action")

        # ── STEP 1: Send OTP ──
        if action == "send_otp":
            full_name  = request.POST.get("name", "").strip()
            email      = request.POST.get("email", "").strip()
            password   = request.POST.get("password", "")
            confirm    = request.POST.get("confirm", "")
            student_id = request.POST.get("student", "").strip()

            # Validations
            if not full_name or not email or not password:
                messages.error(request, "Full name, email and password are required.")
                return render(request, "register.html")
            if password != confirm:
                messages.error(request, "Passwords do not match.")
                return render(request, "register.html")
            if len(password) < 8:
                messages.error(request, "Password must be at least 8 characters.")
                return render(request, "register.html")
            if User.objects.filter(email=email).exists():
                messages.error(request, "An account with this email already exists.")
                return render(request, "register.html")

            # Store form data temporarily in session
            request.session['pending_registration'] = {
                'full_name':  full_name,
                'email':      email,
                'password':   password,
                'student_id': student_id,
            }

            # Generate and send OTP
            # Create a temp user object just for OTP
            # (we use a dummy approach — store OTP in session)
            import random
            otp = str(random.randint(100000, 999999))
            request.session['register_otp']    = otp
            request.session['register_email']  = email

            # Send OTP email
            try:
                send_mail(
                    subject='Verify your Skill Shelf account',
                    message=(
                        f'Hello {full_name},\n\n'
                        f'Your Skill Shelf email verification OTP is: {otp}\n\n'
                        f'This OTP is valid for 10 minutes.\n\n'
                        f'If you did not register, ignore this email.'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False,
                )
                messages.success(request, f'OTP sent to {email}')
                return render(request, "register.html", {
                    'step': 'verify',
                    'email': email,
                })
            except Exception as e:
                messages.error(request, f'Failed to send OTP: {str(e)}')
                return render(request, "register.html")

        # ── STEP 2: Verify OTP and create account ──
        elif action == "verify_otp":
            entered_otp = request.POST.get("otp", "").strip()
            saved_otp   = request.session.get('register_otp')
            email       = request.session.get('register_email')
            pending     = request.session.get('pending_registration')

            if not saved_otp or not pending:
                messages.error(request, "Session expired. Please register again.")
                return render(request, "register.html")

            if entered_otp != saved_otp:
                messages.error(request, "Invalid OTP. Please try again.")
                return render(request, "register.html", {
                    'step': 'verify',
                    'email': email,
                })

            # OTP correct — create the account
            User.objects.create_user(
                email      = pending['email'],
                password   = pending['password'],
                full_name  = pending['full_name'],
                student_id = pending['student_id'],
            )

            # Clear session data
            del request.session['pending_registration']
            del request.session['register_otp']
            del request.session['register_email']

            messages.success(request, "Email verified! Account created. Please log in.")
            return redirect("login")

        # ── RESEND OTP ──
        elif action == "resend_otp":
            import random
            email     = request.session.get('register_email')
            pending   = request.session.get('pending_registration')

            if not email or not pending:
                messages.error(request, "Session expired. Please register again.")
                return render(request, "register.html")

            otp = str(random.randint(100000, 999999))
            request.session['register_otp'] = otp

            try:
                send_mail(
                    subject='Verify your Skill Shelf account',
                    message=(
                        f'Hello {pending["full_name"]},\n\n'
                        f'Your new OTP is: {otp}\n\n'
                        f'Valid for 10 minutes.'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False,
                )
                messages.success(request, f'New OTP sent to {email}')
            except Exception as e:
                messages.error(request, f'Failed to resend OTP: {str(e)}')

            return render(request, "register.html", {
                'step': 'verify',
                'email': email,
            })

    return render(request, "register.html")
# ─────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────

@never_cache
def login_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard")

    if request.method == "POST":
        email    = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")
        user     = authenticate(request, username=email, password=password)

        if user is not None:
            login(request, user)
            next_url = request.POST.get("next") or request.GET.get("next") or "dashboard"
            return redirect(next_url)
        else:
            messages.error(request, "Invalid email or password.")

    return no_cache(render(request, "login.html"))


# ─────────────────────────────────────────────
# LOGOUT
# ─────────────────────────────────────────────

@never_cache
def logout_view(request):
    logout(request)
    request.session.flush()
    response = redirect("welcome")
    response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response['Pragma']        = 'no-cache'
    response['Expires']       = '0'
    return response


# ─────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def dashboard_view(request):
    docs = Document.objects.filter(owner=request.user)

    # Stats
    total_docs    = docs.count()
    total_size    = docs.aggregate(s=Sum('file_size'))['s'] or 0
    recent_docs   = docs.order_by('-uploaded_at')[:4]
    categories_used = docs.values('category').distinct().count()

    # Total size display
    size_mb = total_size / (1024 * 1024)
    if size_mb >= 1024:
        size_display = f"{size_mb/1024:.1f} GB"
    else:
        size_display = f"{size_mb:.1f} MB"

    context = {
        'user':           request.user,
        'total_docs':     total_docs,
        'categories_used': categories_used,
        'recent_docs':    recent_docs,
        'size_display':   size_display,
        'recent_count':   docs.filter(
            uploaded_at__gte=timezone.now() - timezone.timedelta(days=7)
        ).count(),
        'categories':     Document.CATEGORY_CHOICES,
    }
    return no_cache(render(request, "dashboard.html", context))


# ─────────────────────────────────────────────
# DOCUMENTS  — list + filter + search
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def documents_view(request):
    docs = Document.objects.filter(owner=request.user)

    # Search
    q = request.GET.get('q', '').strip()
    if q:
        docs = docs.filter(
            Q(title__icontains=q) |
            Q(description__icontains=q) |
            Q(category__icontains=q) |
            Q(tags__icontains=q)
        )

    # Category filter
    category = request.GET.get('category', '')
    if category:
        docs = docs.filter(category=category)

    # Tag filter
    tag = request.GET.get('tag', '')
    if tag:
        docs = docs.filter(tags=tag)

    # Year filter
    year = request.GET.get('year', '')
    if year:
        docs = docs.filter(uploaded_at__year=year)

    # Size filter
    size = request.GET.get('size', '')
    if size == 'small':
        docs = docs.filter(file_size__lt=1024*1024)
    elif size == 'medium':
        docs = docs.filter(file_size__gte=1024*1024, file_size__lte=2*1024*1024)
    elif size == 'large':
        docs = docs.filter(file_size__gt=2*1024*1024)

    # Sort
    sort = request.GET.get('sort', 'desc')
    if sort == 'asc':
        docs = docs.order_by('uploaded_at')
    elif sort == 'name':
        docs = docs.order_by('title')
    elif sort == 'size':
        docs = docs.order_by('-file_size')
    else:
        docs = docs.order_by('-uploaded_at')

    # Category counts for sidebar
    all_docs  = Document.objects.filter(owner=request.user)
    cat_counts = {}
    for slug, label in Document.CATEGORY_CHOICES:
        count = all_docs.filter(category=slug).count()
        if count > 0:
            cat_counts[slug] = {'label': label, 'count': count}

    # Total count (unfiltered) for sidebar 'All' badge
    total_count = Document.objects.filter(owner=request.user).count()

    # Build safe JSON for the template (used by json_script filter)
    # This avoids Django template tags inside <script> blocks
    documents_json = [
        {
            'id':           doc.id,
            'name':         doc.title,
            'cat':          doc.category_display,
            'date':         doc.uploaded_at.strftime('%Y-%m-%d'),
            'size':         doc.file_size_display,
            'tag':          doc.tags,
            'file_type':    doc.file_type.upper(),
            'file_icon':    doc.file_icon,
            'is_image':     doc.is_image,
            'img':          doc.file.url if doc.is_image and doc.file else '',
            'description':  doc.description or '',
            'uploader':     doc.owner.full_name,
            'lastModified': doc.updated_at.strftime('%Y-%m-%d'),
            'format':       doc.file_type.upper(),
            'pagesCount':   1,
            'downloadUrl':  f'/documents/{doc.id}/download/',
            'deleteUrl':    f'/documents/{doc.id}/delete/',
        }
        for doc in docs
    ]

    context = {
        'user':           request.user,
        'documents':      docs,
        'doc_count':      docs.count(),
        'total_count':    total_count,
        'categories':     Document.CATEGORY_CHOICES,
        'cat_counts':     cat_counts,
        'tag_choices':    Document.TAG_CHOICES,
        'documents_json': documents_json,
        'urls_json':      {},
        'filters': {
            'q': q, 'category': category,
            'tag': tag, 'year': year,
            'size': size, 'sort': sort,
        },
    }
    return no_cache(render(request, "document.html", context))


# ─────────────────────────────────────────────
# UPLOAD  — GET: show form  POST: save file
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def upload_view(request):
    if request.method == "POST":
        files       = request.FILES.getlist("files")
        category    = request.POST.get("category", "other")
        tags        = request.POST.get("tags", "other")
        description = request.POST.get("description", "").strip()
        title_base  = request.POST.get("title", "").strip()

        if not files:
            messages.error(request, "Please select at least one file.")
            return redirect("upload")

        if not category:
            messages.error(request, "Please select a document category.")
            return redirect("upload")

        saved = 0
        for f in files:
            title = title_base if title_base and len(files) == 1 else f.name
            Document.objects.create(
                owner       = request.user,
                title       = title,
                category    = category,
                tags        = tags,
                description = description,
                file        = f,
            )
            saved += 1

        messages.success(request, f"{saved} document(s) uploaded successfully.")
        return redirect("documents")

    # Calculate storage used for display
    total_bytes = Document.objects.filter(owner=request.user).aggregate(
        s=Sum('file_size'))['s'] or 0
    mb = total_bytes / (1024 * 1024)
    if mb >= 1024:
        storage_used = f"{mb/1024:.1f} GB"
    else:
        storage_used = f"{mb:.1f} MB"

    context = {
        'user':         request.user,
        'categories':   Document.CATEGORY_CHOICES,
        'tag_choices':  Document.TAG_CHOICES,
        'storage_used': storage_used,
    }
    return no_cache(render(request, "upload.html", context))


# ─────────────────────────────────────────────
# AJAX UPLOAD  — called by fetch() in upload.js
# Returns JSON so the JS progress bar can work
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def upload_ajax_view(request):
    if request.method != "POST":
        return JsonResponse({'error': 'POST required'}, status=405)

    files       = request.FILES.getlist("files")
    category    = request.POST.get("category", "other")
    tags        = request.POST.get("tags", "other")
    description = request.POST.get("description", "").strip()
    title_base  = request.POST.get("title", "").strip()

    if not files:
        return JsonResponse({'error': 'No files provided'}, status=400)

    if not category:
        return JsonResponse({'error': 'Category is required'}, status=400)

    results = []
    for f in files:
        try:
            title = title_base if title_base and len(files) == 1 else f.name
            doc = Document.objects.create(
                owner       = request.user,
                title       = title,
                category    = category,
                tags        = tags,
                description = description,
                file        = f,
            )
            results.append({
                'name':    f.name,
                'status':  'success',
                'size':    doc.file_size_display,
                'id':      doc.id,
            })
        except Exception as e:
            results.append({
                'name':   f.name,
                'status': 'failed',
                'error':  str(e),
            })

    success_count = sum(1 for r in results if r['status'] == 'success')
    return JsonResponse({
        'results':       results,
        'success_count': success_count,
        'total':         len(files),
    })


# ─────────────────────────────────────────────
# DOCUMENT DETAIL  — view single doc info
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def document_detail_view(request, doc_id):
    doc = get_object_or_404(Document, id=doc_id, owner=request.user)
    return no_cache(render(request, "document_detail.html", {'doc': doc, 'user': request.user}))


# ─────────────────────────────────────────────
# DOCUMENT DOWNLOAD
# ─────────────────────────────────────────────

@login_required(login_url='login')
def document_download_view(request, doc_id):
    doc = get_object_or_404(Document, id=doc_id, owner=request.user)
    if not doc.file:
        raise Http404
    response = FileResponse(doc.file.open('rb'), as_attachment=True, filename=doc.file_name)
    return response


# ─────────────────────────────────────────────
# DOCUMENT DELETE
# ─────────────────────────────────────────────

@login_required(login_url='login')
def document_delete_view(request, doc_id):
    doc = get_object_or_404(Document, id=doc_id, owner=request.user)
    if request.method == "POST":
        # Delete physical file too
        if doc.file and os.path.isfile(doc.file.path):
            os.remove(doc.file.path)
        doc.delete()
        messages.success(request, f'"{doc.title}" deleted successfully.')
        return redirect("documents")
    return redirect("documents")


# ─────────────────────────────────────────────
# PROFILE
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def profile_view(request):
    user = request.user

    if request.method == "POST":
        action = request.POST.get("action")

        if action == "save_profile":
            user.full_name   = request.POST.get("fullName",    user.full_name).strip()
            user.email       = request.POST.get("email",       user.email).strip()
            user.phone       = request.POST.get("phone",       user.phone).strip()
            user.gender      = request.POST.get("gender",      user.gender)
            user.nationality = request.POST.get("nationality", user.nationality).strip()
            user.address     = request.POST.get("address",     user.address).strip()
            user.bio         = request.POST.get("bio",         user.bio).strip()

            dob = request.POST.get("dob", "")
            if dob:
                user.date_of_birth = dob

            if "profile_photo" in request.FILES:
                user.profile_photo = request.FILES["profile_photo"]

            user.save()
            messages.success(request, "Profile updated successfully.")
            return redirect("profile")

        elif action == "change_password":
            current = request.POST.get("currentPassword", "")
            new_pw  = request.POST.get("newPassword",     "")
            confirm = request.POST.get("confirmPassword", "")

            if not user.check_password(current):
                messages.error(request, "Current password is incorrect.")
                return redirect("profile")
            if new_pw != confirm:
                messages.error(request, "New passwords do not match.")
                return redirect("profile")
            if len(new_pw) < 8:
                messages.error(request, "Password must be at least 8 characters.")
                return redirect("profile")

            user.set_password(new_pw)
            user.save()
            update_session_auth_hash(request, user)
            messages.success(request, "Password changed successfully.")
            return redirect("profile")

    return no_cache(render(request, "profile.html", {"user": user}))


# ─────────────────────────────────────────────
# CHAT PAGE
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def chat_view(request):
    warnings = get_expiry_warnings(request.user)
    context  = {
        'user':            request.user,
        'expiry_warnings': warnings,
        'doc_count':       Document.objects.filter(owner=request.user).count(),
    }
    return no_cache(render(request, 'chat.html', context))


# ─────────────────────────────────────────────
# CHAT API  — permanent memory per user
# ─────────────────────────────────────────────

@require_POST
@login_required(login_url='login')
def chat_api(request):
    try:
        body    = json.loads(request.body)
        message = (body.get('message') or '').strip()
        doc_id  = body.get('doc_id')

        if not message:
            return JsonResponse({'error': 'Empty message'}, status=400)

        if doc_id:
            try:
                doc_id = int(doc_id)
                Document.objects.get(id=doc_id, owner=request.user)
            except (Document.DoesNotExist, ValueError):
                doc_id = None

        # ── Load full chat history from DB ──────────────────────
        past = ChatMessage.objects.filter(
            owner=request.user
        ).order_by('-created_at')[:40]
        past = list(reversed(past))

        history = [
            {
                'role':  'user' if m.role == 'user' else 'model',
                'parts': [m.message]
            }
            for m in past
        ]

        # ── Get AI reply ────────────────────────────────────────
        reply    = ai_chat(request.user, message, history, target_doc_id=doc_id)
        warnings = get_expiry_warnings(request.user)

        # ── Save both messages to DB permanently ────────────────
        ChatMessage.objects.create(owner=request.user, role='user', message=message)
        ChatMessage.objects.create(owner=request.user, role='bot',  message=reply)

        return JsonResponse({'reply': reply, 'warnings': warnings})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# CHAT HISTORY API  — load past messages for widget
# ─────────────────────────────────────────────

@login_required(login_url='login')
def chat_history_api(request):
    """Returns the last 50 messages for the logged-in user."""
    msgs = ChatMessage.objects.filter(
        owner=request.user
    ).order_by('-created_at')[:50]
    msgs = list(reversed(msgs))

    data = [
        {
            'role':    m.role,
            'message': m.message,
            'time':    m.created_at.strftime('%I:%M %p'),
            'date':    m.created_at.strftime('%Y-%m-%d'),
        }
        for m in msgs
    ]
    return JsonResponse({'messages': data})


# ─────────────────────────────────────────────
# CLEAR CHAT HISTORY API
# ─────────────────────────────────────────────

@require_POST
@login_required(login_url='login')
def chat_clear_api(request):
    """Deletes all chat history for the logged-in user."""
    ChatMessage.objects.filter(owner=request.user).delete()
    return JsonResponse({'status': 'cleared'})


# ─────────────────────────────────────────────
# SEND OTP
# ─────────────────────────────────────────────

@csrf_exempt
def send_otp_view(request):
    if request.method != "POST":
        return JsonResponse({'error': 'POST required'}, status=405)

    data   = json.loads(request.body)
    method = data.get('method')
    value  = data.get('value', '').strip()

    # Find user
    try:
        if method == 'email':
            user = User.objects.get(email=value)
        else:
            user = User.objects.get(phone=value)
    except User.DoesNotExist:
        return JsonResponse({'error': 'No account found with these details.'}, status=404)

    # Generate OTP
    otp = OTPVerification.generate_otp()

    # Save OTP to DB (delete old ones first)
    OTPVerification.objects.filter(user=user, method=method, is_used=False).delete()
    OTPVerification.objects.create(user=user, otp=otp, method=method)

    # ── Send via Email ──
    if method == 'email':
        try:
            send_mail(
                subject='Your Skill Shelf OTP',
                message=(
                    f'Hello {user.full_name},\n\n'
                    f'Your OTP for Skill Shelf login is: {otp}\n\n'
                    f'This OTP is valid for 5 minutes.\n\n'
                    f'Do not share this OTP with anyone.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[value],
                fail_silently=False,
            )
            return JsonResponse({'success': True, 'message': f'OTP sent to {value}'})
        except Exception as e:
            return JsonResponse({'error': f'Failed to send email: {str(e)}'}, status=500)

    elif method == 'mobile':
        try:
            # Clean number
            clean_number = value.strip()
            if clean_number.startswith('+91'):
                clean_number = clean_number[3:]
            elif clean_number.startswith('91') and len(clean_number) == 12:
                clean_number = clean_number[2:]
            elif clean_number.startswith('0'):
                clean_number = clean_number[1:]

            if not clean_number.isdigit() or len(clean_number) != 10:
                return JsonResponse({'error': 'Please enter a valid 10-digit mobile number.'}, status=400)

            # Format to international format for Twilio
            phone_international = f'+91{clean_number}'

            from twilio.rest import Client
            client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN
            )

            message = client.messages.create(
                body=(
                    f'Hello! Your Skill Shelf OTP is: {otp}\n'
                    f'Valid for 5 minutes. Do not share with anyone.'
                ),
                from_=settings.TWILIO_PHONE_NUMBER,
                to=phone_international
            )

            print(f"[Twilio] Message SID: {message.sid}")
            print(f"[Twilio] Status: {message.status}")

            return JsonResponse({
                'success': True,
                'message': f'OTP sent to {clean_number}'
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': f'SMS error: {str(e)}'}, status=500)
    return JsonResponse({'error': 'Invalid method'}, status=400)

# ─────────────────────────────────────────────
# VERIFY OTP  — login user after OTP check
# ─────────────────────────────────────────────

@csrf_exempt
def verify_otp_view(request):
    if request.method != "POST":
        return JsonResponse({'error': 'POST required'}, status=405)

    data   = json.loads(request.body)
    method = data.get('method')
    value  = data.get('value', '').strip()
    otp    = data.get('otp', '').strip()

    try:
        if method == 'email':
            user = User.objects.get(email=value)
        else:
            user = User.objects.get(phone=value)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found.'}, status=404)

    # Find latest unused OTP
    try:
        otp_obj = OTPVerification.objects.filter(
            user=user, method=method, is_used=False
        ).latest('created_at')
    except OTPVerification.DoesNotExist:
        return JsonResponse({'error': 'No OTP found. Please request a new one.'}, status=400)

    if otp_obj.is_expired():
        return JsonResponse({'error': 'OTP has expired. Please request a new one.'}, status=400)

    if otp_obj.otp != otp:
        return JsonResponse({'error': 'Invalid OTP. Please try again.'}, status=400)

    # Mark OTP as used
    otp_obj.is_used = True
    otp_obj.save()

    # Log the user in
    from django.contrib.auth import login
    user.backend = 'django.contrib.auth.backends.ModelBackend'
    login(request, user)

    return JsonResponse({'success': True, 'redirect': '/dashboard/'})


# ─────────────────────────────────────────────
# RESEND OTP
# ─────────────────────────────────────────────

@csrf_exempt
def resend_otp_view(request):
    # Just call send_otp_view again
    return send_otp_view(request)