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
from .models import User, Document, OTPVerification
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
# LOGIN NOTIFICATION — Email or SMS
# Called after every successful login
# ─────────────────────────────────────────────

def send_login_notification(user, request):
    """
    Sends a login alert via Email or SMS depending on user's
    notification_preference. If preference is 'none', no alert is sent.
    """
    preference = getattr(user, 'notification_preference', 'email')

    if preference == 'none':
        return  # User opted out of all notifications

    # ── Gather login details ──
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR', 'Unknown')

    user_agent = request.META.get('HTTP_USER_AGENT', '')

    if 'Mobile' in user_agent or 'Android' in user_agent:
        device = 'Mobile'
    elif 'Tablet' in user_agent or 'iPad' in user_agent:
        device = 'Tablet'
    else:
        device = 'Desktop / Laptop'

    if 'Chrome' in user_agent and 'Edg' not in user_agent:
        browser = 'Google Chrome'
    elif 'Firefox' in user_agent:
        browser = 'Mozilla Firefox'
    elif 'Safari' in user_agent and 'Chrome' not in user_agent:
        browser = 'Safari'
    elif 'Edg' in user_agent:
        browser = 'Microsoft Edge'
    else:
        browser = 'Unknown Browser'

    login_time = timezone.localtime(timezone.now()).strftime('%d %B %Y, %I:%M %p')

    # ── Send Email notification ──
    if preference == 'email':
        try:
            send_mail(
                subject='🔐 Skill Shelf — New Login Detected on Your Account',
                message=(
                    f"Hello {user.full_name},\n\n"
                    f"A recent login activity was detected on your Skill Shelf account.\n\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"  LOGIN DETAILS\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"  📅 Date & Time  : {login_time}\n"
                    f"  🌐 IP Address   : {ip}\n"
                    f"  💻 Device       : {device}\n"
                    f"  🌍 Browser      : {browser}\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"✅ Is this you?\n"
                    f"   No action needed. You can ignore this email.\n\n"
                    f"❌ Not you?\n"
                    f"   Immediately secure your account:\n"
                    f"   → Change your password now\n"
                    f"   → Enable Two Factor Authentication (2FA)\n\n"
                    f"Stay safe,\n"
                    f"Skill Shelf Security Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception:
            pass  # Never block login because of email failure

    elif preference == 'sms':
        try:
            if not user.phone:
                return

            from twilio.rest import Client

            client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
            )

            login_time = timezone.localtime(
                timezone.now()
            ).strftime('%d %B %Y, %I:%M %p')

            sms_body = (
                f"[Skill Shelf] A new sign-in to your account "
                f"was detected on {login_time}. "
                f"If this was you, ignore this message. "
                f"If not, secure your account immediately."
            )

            # Send SMS using your Twilio phone number
            client.messages.create(
                body  = sms_body,
                from_ = settings.TWILIO_PHONE_NUMBER,
                to    = f"+91{user.phone}",
            )

        except Exception as e:
            pass  # Never block login due to SMS failure
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

def register_view(request):
    if request.method == "POST":
        action = request.POST.get("action")

        if action == "send_otp":
            full_name  = request.POST.get("name", "").strip()
            email      = request.POST.get("email", "").strip()
            password   = request.POST.get("password", "")
            confirm    = request.POST.get("confirm", "")
            student_id = request.POST.get("student", "").strip()

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

            request.session['pending_registration'] = {
                'full_name':  full_name,
                'email':      email,
                'password':   password,
                'student_id': student_id,
            }

            import random
            otp = str(random.randint(100000, 999999))
            request.session['register_otp']   = otp
            request.session['register_email'] = email

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

            User.objects.create_user(
                email      = pending['email'],
                password   = pending['password'],
                full_name  = pending['full_name'],
                student_id = pending['student_id'],
            )

            del request.session['pending_registration']
            del request.session['register_otp']
            del request.session['register_email']

            messages.success(request, "Email verified! Account created. Please log in.")
            return redirect("login")

        elif action == "resend_otp":
            import random
            email   = request.session.get('register_email')
            pending = request.session.get('pending_registration')

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
# LOGIN — with notification on success
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
            if user.is_2fa_enabled:
                # Don't login yet — send OTP first via Twilio Verify
                if not user.phone:
                    messages.error(request, "2FA is enabled but no phone number found. Please contact support.")
                    return no_cache(render(request, "login.html"))

                try:
                    from twilio.rest import Client
                    client = Client(
                        settings.TWILIO_ACCOUNT_SID,
                        settings.TWILIO_AUTH_TOKEN,
                    )
                    client.verify.v2 \
                        .services(settings.TWILIO_VERIFY_SERVICE_SID) \
                        .verifications \
                        .create(to=f"+91{user.phone}", channel="sms")
                except Exception as e:
                    messages.error(request, f"Failed to send OTP: {str(e)}")
                    return no_cache(render(request, "login.html"))

                # Store user id in session temporarily — don't login yet
                request.session['2fa_user_id']   = user.id
                request.session['2fa_next_url']  = request.POST.get("next") or "dashboard"
                return redirect('2fa_verify')

            else:
                # 2FA not enabled — login directly as before
                login(request, user)
                send_login_notification(user, request)
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
    request.session.pop('doc_unlocked', None)
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

    total_docs      = docs.count()
    total_size      = docs.aggregate(s=Sum('file_size'))['s'] or 0
    recent_docs     = docs.order_by('-uploaded_at')[:4]
    categories_used = docs.values('category').distinct().count()

    size_mb = total_size / (1024 * 1024)
    if size_mb >= 1024:
        size_display = f"{size_mb/1024:.1f} GB"
    else:
        size_display = f"{size_mb:.1f} MB"

    context = {
        'user':             request.user,
        'total_docs':       total_docs,
        'categories_used':  categories_used,
        'recent_docs':      recent_docs,
        'size_display':     size_display,
        'recent_count':     docs.filter(
            uploaded_at__gte=timezone.now() - timezone.timedelta(days=7)
        ).count(),
        'categories':       Document.CATEGORY_CHOICES,
    }
    return no_cache(render(request, "dashboard.html", context))


# ─────────────────────────────────────────────
# DOCUMENTS
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def documents_view(request):
    user         = request.user
    has_passcode = bool(user.doc_passcode)
    is_unlocked  = request.session.get('doc_unlocked', False)

    if not has_passcode:
        context = {
            'user':           request.user,
            'needs_passcode': True,
            'has_passcode':   False,
            'documents':      [],
            'doc_count':      0,
            'total_count':    0,
            'categories':     Document.CATEGORY_CHOICES,
            'cat_counts':     {},
            'tag_choices':    Document.TAG_CHOICES,
            'documents_json': [],
            'filters':        {},
        }
        return no_cache(render(request, 'document.html', context))

    if has_passcode and not is_unlocked:
        context = {
            'user':           request.user,
            'needs_passcode': True,
            'has_passcode':   True,
            'documents':      [],
            'doc_count':      0,
            'total_count':    0,
            'categories':     Document.CATEGORY_CHOICES,
            'cat_counts':     {},
            'tag_choices':    Document.TAG_CHOICES,
            'documents_json': [],
            'filters':        {},
        }
        return no_cache(render(request, 'document.html', context))

    docs = Document.objects.filter(owner=request.user)

    q = request.GET.get('q', '').strip()
    if q:
        docs = docs.filter(
            Q(title__icontains=q) |
            Q(description__icontains=q) |
            Q(category__icontains=q) |
            Q(tags__icontains=q)
        )

    category = request.GET.get('category', '')
    if category:
        docs = docs.filter(category=category)

    tag = request.GET.get('tag', '')
    if tag:
        docs = docs.filter(tags=tag)

    year = request.GET.get('year', '')
    if year:
        docs = docs.filter(uploaded_at__year=year)

    size = request.GET.get('size', '')
    if size == 'small':
        docs = docs.filter(file_size__lt=1024*1024)
    elif size == 'medium':
        docs = docs.filter(file_size__gte=1024*1024, file_size__lte=2*1024*1024)
    elif size == 'large':
        docs = docs.filter(file_size__gt=2*1024*1024)

    sort = request.GET.get('sort', 'desc')
    if sort == 'asc':
        docs = docs.order_by('uploaded_at')
    elif sort == 'name':
        docs = docs.order_by('title')
    elif sort == 'size':
        docs = docs.order_by('-file_size')
    else:
        docs = docs.order_by('-uploaded_at')

    all_docs   = Document.objects.filter(owner=request.user)
    cat_counts = {}
    for slug, label in Document.CATEGORY_CHOICES:
        count = all_docs.filter(category=slug).count()
        if count > 0:
            cat_counts[slug] = {'label': label, 'count': count}

    total_count    = Document.objects.filter(owner=request.user).count()
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
        'has_passcode':   has_passcode,
        'needs_passcode': False,
        'filters': {
            'q': q, 'category': category,
            'tag': tag, 'year': year,
            'size': size, 'sort': sort,
        },
    }
    return no_cache(render(request, 'document.html', context))


# ─────────────────────────────────────────────
# UPLOAD
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

    total_bytes = Document.objects.filter(owner=request.user).aggregate(
        s=Sum('file_size'))['s'] or 0
    mb = total_bytes / (1024 * 1024)
    storage_used = f"{mb/1024:.1f} GB" if mb >= 1024 else f"{mb:.1f} MB"

    context = {
        'user':         request.user,
        'categories':   Document.CATEGORY_CHOICES,
        'tag_choices':  Document.TAG_CHOICES,
        'storage_used': storage_used,
    }
    return no_cache(render(request, "upload.html", context))


# ─────────────────────────────────────────────
# AJAX UPLOAD
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
            results.append({'name': f.name, 'status': 'success', 'size': doc.file_size_display, 'id': doc.id})
        except Exception as e:
            results.append({'name': f.name, 'status': 'failed', 'error': str(e)})

    success_count = sum(1 for r in results if r['status'] == 'success')
    return JsonResponse({'results': results, 'success_count': success_count, 'total': len(files)})


# ─────────────────────────────────────────────
# DOCUMENT DETAIL / DOWNLOAD / DELETE
# ─────────────────────────────────────────────

@never_cache
@login_required(login_url='login')
def document_detail_view(request, doc_id):
    doc = get_object_or_404(Document, id=doc_id, owner=request.user)
    return no_cache(render(request, "document_detail.html", {'doc': doc, 'user': request.user}))


@login_required(login_url='login')
def document_download_view(request, doc_id):
    doc = get_object_or_404(Document, id=doc_id, owner=request.user)
    if not doc.file:
        raise Http404
    return FileResponse(doc.file.open('rb'), as_attachment=True, filename=doc.file_name)


@login_required(login_url='login')
def document_delete_view(request, doc_id):
    doc = get_object_or_404(Document, id=doc_id, owner=request.user)
    if request.method == "POST":
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
            user.full_name   = request.POST.get("fullName", user.full_name).strip()
            user.email       = request.POST.get("email", user.email).strip()
            user.phone       = request.POST.get("phone", user.phone).strip()
            user.gender      = request.POST.get("gender", user.gender)
            user.nationality = request.POST.get("nationality", user.nationality).strip()
            user.address     = request.POST.get("address", user.address).strip()
            user.bio         = request.POST.get("bio", user.bio).strip()

            if "dob" in request.POST and request.POST["dob"]:
                user.date_of_birth = request.POST["dob"]

            if "profile_photo" in request.FILES:
                user.profile_photo = request.FILES["profile_photo"]

            user.save()
            messages.success(request, "Profile updated successfully.")
            return redirect("profile")

        elif action == "change_password":
            new_pw  = request.POST.get("newPassword", "").strip()
            confirm = request.POST.get("confirmPassword", "").strip()

            if not new_pw or not confirm:
                messages.error(request, "Both password fields are required.")
                return redirect("profile")
            if new_pw != confirm:
                messages.error(request, "New passwords do not match.")
                return redirect("profile")
            if len(new_pw) < 8:
                messages.error(request, "Password must be at least 8 characters long.")
                return redirect("profile")

            user.set_password(new_pw)
            user.save()
            update_session_auth_hash(request, user)
            messages.success(request, "Password changed successfully!")
            return redirect("profile")

        elif action == "change_passkey":
            new_code = request.POST.get("passkey", "").strip()
            if not new_code or len(new_code) != 4 or not new_code.isdigit():
                messages.error(request, "Passkey must be a valid 4-digit number.")
                return redirect("profile")
            user.doc_passcode = new_code
            user.save()
            messages.success(request, "Document Passkey updated successfully!")
            return redirect("profile")

    context = {
        "user":       user,
        "categories": Document.CATEGORY_CHOICES,
    }
    return no_cache(render(request, "profile.html", context))


# ─────────────────────────────────────────────
# SAVE SETTINGS — Notification preference
# AJAX endpoint called from profile.js
# ─────────────────────────────────────────────

@require_POST
@login_required(login_url='login')
def save_settings_view(request):
    """
    Saves notification_preference to the database.
    Accepts JSON: { "notification": "email" | "sms" | "none" }
    Returns JSON: { "success": true } or { "error": "..." }
    """
    try:
        data         = json.loads(request.body)
        notification = data.get('notification', 'none')

        # Validate
        valid_options = ['email', 'sms', 'none']
        if notification not in valid_options:
            return JsonResponse({'error': 'Invalid notification preference.'}, status=400)

        # If SMS is selected, make sure phone number exists
        if notification == 'sms' and not request.user.phone:
            return JsonResponse({
                'error': 'Please add your phone number in Profile tab before enabling SMS notifications.'
            }, status=400)

        # Save preference to database
        request.user.notification_preference = notification
        request.user.save(update_fields=['notification_preference'])

        label_map = {'email': 'Email', 'sms': 'SMS', 'none': 'None'}
        return JsonResponse({
            'success': True,
            'message': f'Notification preference saved: {label_map[notification]}',
            'preference': notification,
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid request.'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


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
# CHAT API
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

        reply    = ai_chat(request.user, message, history, target_doc_id=doc_id)
        warnings = get_expiry_warnings(request.user)

        ChatMessage.objects.create(owner=request.user, role='user', message=message)
        ChatMessage.objects.create(owner=request.user, role='bot',  message=reply)

        return JsonResponse({'reply': reply, 'warnings': warnings})

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='login')
def chat_history_api(request):
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


@require_POST
@login_required(login_url='login')
def chat_clear_api(request):
    ChatMessage.objects.filter(owner=request.user).delete()
    return JsonResponse({'status': 'cleared'})


# ─────────────────────────────────────────────
# SEND OTP FOR SECURITY (Password / Passkey)
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# SEND OTP — PUBLIC ENDPOINT (No login required)
# ─────────────────────────────────────────────

@csrf_exempt
@require_POST
def send_otp_view(request):
    try:
        data = json.loads(request.body)          # ← ADD THIS LINE
        email = data.get('email', '').strip()
        method = data.get('method', 'email')

        # If no email provided but user is logged in, use their email
        if not email:
            if request.user.is_authenticated:
                email = request.user.email
            else:
                return JsonResponse({'error': 'Email is required'}, status=400)

        # Check if user exists
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse({'error': 'No account found with this email'}, status=404)

        # Generate OTP
        import random
        otp = str(random.randint(100000, 999999))

        # Save OTP
        OTPVerification.objects.filter(user=user, method='email', is_used=False).delete()
        OTPVerification.objects.create(
            user=user,
            otp=otp,
            method='email'
        )

        # Send Email
        try:
            send_mail(
                subject='Skill Shelf - Login OTP',
                message=(
                    f'Hello {user.full_name or "User"},\n\n'
                    f'Your Skill Shelf login OTP is: **{otp}**\n\n'
                    f'This OTP is valid for 10 minutes.\n\n'
                    f'If you did not request this, please ignore this email.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            return JsonResponse({
                'success': True,
                'message': f'OTP sent successfully to {email}'
            })
        except Exception as e:
            return JsonResponse({'error': f'Failed to send email: {str(e)}'}, status=500)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# ─────────────────────────────────────────────
# VERIFY OTP
# ─────────────────────────────────────────────

@csrf_exempt
@require_POST
def verify_otp_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip()
        otp = data.get('otp', '').strip()

        if not email or not otp:
            return JsonResponse({'error': 'Email and OTP are required'}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse({'error': 'User not found'}, status=404)

        # Get latest unused OTP
        try:
            otp_obj = OTPVerification.objects.filter(
                user=user, 
                method='email', 
                is_used=False
            ).latest('created_at')
        except OTPVerification.DoesNotExist:
            return JsonResponse({'error': 'No OTP found. Please request a new one.'}, status=400)

        if otp_obj.is_expired():
            return JsonResponse({'error': 'OTP has expired. Please request a new one.'}, status=400)

        if otp_obj.otp != otp:
            return JsonResponse({'error': 'Invalid OTP'}, status=400)

        # Mark OTP as used
        otp_obj.is_used = True
        otp_obj.save()

        # Log the user in
        login(request, user)

        return JsonResponse({
            'success': True,
            'message': 'Login successful',
            'redirect': '/dashboard/'
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def resend_otp_view(request):
    return send_otp_view(request)   # Reuse the same logic

@csrf_exempt
def verify_otp_only(request):
    if request.method != "POST":
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        data = json.loads(request.body)
        otp  = data.get('otp', '').strip()

        if not request.user.is_authenticated:
            return JsonResponse({'error': 'User not logged in.'}, status=401)

        user    = request.user
        otp_obj = OTPVerification.objects.filter(
            user=user, method='email', is_used=False
        ).latest('created_at')

        if otp_obj.is_expired():
            return JsonResponse({'error': 'OTP has expired. Please request a new one.'}, status=400)
        if otp_obj.otp != otp:
            return JsonResponse({'error': 'Invalid OTP. Please try again.'}, status=400)

        otp_obj.is_used = True
        otp_obj.save()

        return JsonResponse({'success': True})

    except OTPVerification.DoesNotExist:
        return JsonResponse({'error': 'No OTP found. Please request a new one.'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# ─────────────────────────────────────────────
# DOCUMENT PASSCODE
# ─────────────────────────────────────────────

@csrf_exempt
@login_required(login_url='login')
def verify_doc_passcode(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        data   = json.loads(request.body)
        action = data.get('action')
        code   = data.get('code', '').strip()

        if not code.isdigit() or len(code) != 4:
            return JsonResponse({'error': 'Passcode must be exactly 4 digits.'}, status=400)

        user = request.user

        if action == 'set':
            user.doc_passcode = code
            user.save()
            request.session['doc_unlocked'] = True
            request.session.modified = True
            return JsonResponse({'success': True, 'message': 'Passcode set!'})

        elif action == 'verify':
            if not user.doc_passcode:
                return JsonResponse({'error': 'No passcode set.'}, status=400)
            if user.doc_passcode == code:
                request.session['doc_unlocked'] = True
                request.session.modified = True
                return JsonResponse({'success': True})
            else:
                return JsonResponse({'error': 'Incorrect passcode. Try again.'}, status=400)

        return JsonResponse({'error': 'Invalid action.'}, status=400)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    

# ─────────────────────────────────────────────
# 2FA VERIFY PAGE — shown after password login
# ─────────────────────────────────────────────

@never_cache
def two_fa_verify_view(request):
    user_id = request.session.get('2fa_user_id')
    if not user_id:
        return redirect('login')

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return redirect('login')

    if request.method == 'POST':
        otp      = request.POST.get('otp', '').strip()
        next_url = request.session.get('2fa_next_url', 'dashboard')

        if not otp or len(otp) != 6:
            return render(request, '2fa_verify.html', {
                'phone_hint': user.phone[-4:],
                'error': 'Please enter the 6-digit OTP.',
            })

        try:
            from twilio.rest import Client
            client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
            )
            result = client.verify.v2 \
                .services(settings.TWILIO_VERIFY_SERVICE_SID) \
                .verification_checks \
                .create(to=f"+91{user.phone}", code=otp)

            if result.status == 'approved':
                # OTP correct — now actually log the user in
                login(request, user)
                send_login_notification(user, request)

                # Clean up session
                del request.session['2fa_user_id']
                del request.session['2fa_next_url']

                return redirect(next_url)
            else:
                return render(request, '2fa_verify.html', {
                    'phone_hint': user.phone[-4:],
                    'error': 'Invalid OTP. Please try again.',
                })

        except Exception as e:
            return render(request, '2fa_verify.html', {
                'phone_hint': user.phone[-4:],
                'error': f'Verification failed: {str(e)}',
            })

    # GET request — show the page
    return no_cache(render(request, '2fa_verify.html', {
        'phone_hint': user.phone[-4:],
    }))


# ─────────────────────────────────────────────
# 2FA RESEND OTP — called via AJAX from 2fa page
# ─────────────────────────────────────────────

@require_POST
def two_fa_resend_view(request):
    user_id = request.session.get('2fa_user_id')
    if not user_id:
        return JsonResponse({'error': 'Session expired.'}, status=400)

    try:
        user = User.objects.get(id=user_id)
        from twilio.rest import Client
        client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN,
        )
        client.verify.v2 \
            .services(settings.TWILIO_VERIFY_SERVICE_SID) \
            .verifications \
            .create(to=f"+91{user.phone}", channel="sms")

        return JsonResponse({'success': True})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# TOGGLE 2FA — called via AJAX from Security tab
# ─────────────────────────────────────────────

@require_POST
@login_required(login_url='login')
def toggle_2fa_view(request):
    try:
        data   = json.loads(request.body)
        enable = data.get('enable', False)
        user   = request.user

        if enable:
            # Check phone number exists
            if not user.phone:
                return JsonResponse({
                    'error': 'no_phone',
                    'message': 'Please add your phone number in Profile tab first.'
                }, status=400)

            # Send OTP to verify phone before enabling
            from twilio.rest import Client
            client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
            )
            client.verify.v2 \
                .services(settings.TWILIO_VERIFY_SERVICE_SID) \
                .verifications \
                .create(to=f"+91{user.phone}", channel="sms")

            return JsonResponse({
                'success':    True,
                'otp_sent':   True,
                'phone_hint': user.phone[-4:],
                'message':    f'OTP sent to number ending in {user.phone[-4:]}',
            })

        else:
            # Disable 2FA directly — no OTP needed
            user.is_2fa_enabled = False
            user.save(update_fields=['is_2fa_enabled'])
            return JsonResponse({
                'success': True,
                'enabled': False,
                'message': '2FA disabled successfully.',
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)


# ─────────────────────────────────────────────
# CONFIRM 2FA ENABLE — verify OTP then enable
# ─────────────────────────────────────────────

@require_POST
@login_required(login_url='login')
def confirm_2fa_view(request):
    try:
        data = json.loads(request.body)
        otp  = data.get('otp', '').strip()
        user = request.user

        if not otp or len(otp) != 6:
            return JsonResponse({'error': 'Enter the 6-digit OTP.'}, status=400)

        from twilio.rest import Client
        client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN,
        )
        result = client.verify.v2 \
            .services(settings.TWILIO_VERIFY_SERVICE_SID) \
            .verification_checks \
            .create(to=f"+91{user.phone}", code=otp)

        if result.status == 'approved':
            user.is_2fa_enabled = True
            user.save(update_fields=['is_2fa_enabled'])
            return JsonResponse({
                'success': True,
                'enabled': True,
                'message': '2FA enabled successfully! Your account is now more secure.',
            })
        else:
            return JsonResponse({'error': 'Invalid OTP. Please try again.'}, status=400)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# Simple ping to keep session alive
@login_required(login_url='login')
def ping_view(request):
    # Just return success - this resets the session timer
    return JsonResponse({'status': 'ok'})

# Ping view to keep session alive when user clicks "Stay Logged In"
@login_required(login_url='login')
def keep_alive_view(request):
    # This empty view just resets the session timer on the server
    return JsonResponse({'status': 'alive'})