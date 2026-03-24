from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from django.core.validators import FileExtensionValidator
import os


def user_profile_photo_path(instance, filename):
    return f"profile_photos/user_{instance.id}/{filename}"


def document_file_path(instance, filename):
    """Store documents at: media/documents/user_<id>/<category>/<filename>"""
    return f"documents/user_{instance.owner.id}/{instance.category}/{filename}"


# ─────────────────────────────────────────────
# CUSTOM USER MANAGER
# ─────────────────────────────────────────────

class UserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        user  = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(email, password, **extra_fields)


# ─────────────────────────────────────────────
# USER  —  single table for all user data
# ─────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):

    GENDER_CHOICES = [
        ("male",              "Male"),
        ("female",            "Female"),
        ("other",             "Other"),
        ("prefer-not-to-say", "Prefer not to say"),
    ]

    # Registration fields
    full_name   = models.CharField(max_length=200)
    email       = models.EmailField(unique=True)
    student_id  = models.CharField(max_length=50, blank=True)

    # Profile fields
    phone         = models.CharField(max_length=20,  blank=True)
    gender        = models.CharField(max_length=20,  choices=GENDER_CHOICES, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality   = models.CharField(max_length=100, blank=True)
    address       = models.TextField(blank=True)
    bio           = models.TextField(blank=True)
    profile_photo = models.ImageField(
        upload_to=user_profile_photo_path,
        null=True, blank=True
    )

    doc_passcode = models.CharField(max_length=4, blank=True, null=True)
    
    # Django internals
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "skillshelf_user"

    def __str__(self):
        return f"{self.full_name} ({self.email})"


# ─────────────────────────────────────────────
# DOCUMENT  —  stores every uploaded file
# ─────────────────────────────────────────────

class Document(models.Model):

    # ── Category choices (matches your dashboard UI) ──────────────
    CATEGORY_CHOICES = [
        ("academic_records",            "Academic Records"),
        ("academic_achievements",       "Academic Achievements"),
        ("professional_awards",         "Professional Awards"),
        ("competition_awards",          "Competition Awards"),
        ("certifications",              "Certifications"),
        ("internship_documents",        "Internship Documents"),
        ("identity_documents",          "Identity Documents"),
        ("professional_certifications", "Professional Certifications"),
        ("technical_certifications",    "Technical Certifications"),
        ("government_legal",            "Government/Legal Certificates"),
        ("projects",                    "Projects"),
        ("language_certificates",       "Language Certificates"),
        ("address_proofs",              "Address Proofs"),
        ("business_documents",          "Business Documents"),
        ("project_documents",           "Project Documents"),
        ("recommendation_letters",      "Recommendation Letters"),
        ("employment_documents",        "Employment Documents"),
        ("health_certificates",         "Health Certificates"),
        ("property_documents",          "Property Documents"),
        ("resumes",                     "Resumes"),
        ("photo_documents",             "Photo Documents"),
        ("other",                       "Other"),
    ]

    # ── Tag choices (matches your document.js filters) ─────────────
    TAG_CHOICES = [
        ("important", "Important"),
        ("official",  "Official"),
        ("personal",  "Personal"),
        ("other",     "Other"),
    ]

    # ── Status ────────────────────────────────────────────────────
    STATUS_CHOICES = [
        ("active",   "Active"),
        ("expired",  "Expired"),
        ("archived", "Archived"),
    ]
    expiry_date = models.DateField(null=True, blank=True, help_text="e.g. passport/ID expiry date")



    # ── Allowed file extensions ────────────────────────────────────
    ALLOWED_EXTENSIONS = [
        "pdf", "doc", "docx",
        "jpg", "jpeg", "png",
        "zip",
    ]

    # ── Relationships ─────────────────────────────────────────────
    owner    = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="documents"
    )

    # ── Core fields ───────────────────────────────────────────────
    title       = models.CharField(max_length=255)
    category    = models.CharField(
        max_length=60,
        choices=CATEGORY_CHOICES,
        default="other"
    )
    description = models.TextField(blank=True)
    tags        = models.CharField(
        max_length=20,
        choices=TAG_CHOICES,
        default="other"
    )
    status      = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="active"
    )

    # ── File ─────────────────────────────────────────────────────
    file      = models.FileField(
        upload_to=document_file_path,
        validators=[FileExtensionValidator(allowed_extensions=ALLOWED_EXTENSIONS)]
    )
    file_name = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)  # bytes
    file_type = models.CharField(max_length=10, blank=True)  # pdf/jpg/png etc

    # ── Timestamps ────────────────────────────────────────────────
    uploaded_at   = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "skillshelf_document"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.title} — {self.owner.full_name}"

    def save(self, *args, **kwargs):
        # Auto-fill file metadata before saving
        if self.file:
            self.file_name = os.path.basename(self.file.name)
            if "." in self.file_name:
                self.file_type = self.file_name.rsplit(".", 1)[-1].lower()
            try:
                self.file_size = self.file.size
            except Exception:
                pass
        super().save(*args, **kwargs)

    # ── Helper properties ─────────────────────────────────────────

    @property
    def file_size_display(self):
        """Human-readable size: 1.2 MB"""
        size = self.file_size
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"

    @property
    def category_display(self):
        return dict(self.CATEGORY_CHOICES).get(self.category, self.category)

    @property
    def file_icon(self):
        """Returns font-awesome class based on file type"""
        icons = {
            "pdf":  "fa-file-pdf",
            "doc":  "fa-file-word",
            "docx": "fa-file-word",
            "jpg":  "fa-file-image",
            "jpeg": "fa-file-image",
            "png":  "fa-file-image",
            "zip":  "fa-file-archive",
        }
        return icons.get(self.file_type, "fa-file-alt")

    @property
    def is_image(self):
        return self.file_type in ["jpg", "jpeg", "png"]
    

class ChatMessage(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('bot',  'Bot'),
    ]
    owner      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_messages')
    role       = models.CharField(max_length=10, choices=ROLE_CHOICES)
    message    = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'skillshelf_chat'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.owner.email} [{self.role}]: {self.message[:50]}"


import random
from django.utils import timezone

class OTPVerification(models.Model):
    METHOD_CHOICES = [('email', 'Email'), ('mobile', 'Mobile')]

    user       = models.ForeignKey(User, on_delete=models.CASCADE)
    otp        = models.CharField(max_length=6)
    method     = models.CharField(max_length=10, choices=METHOD_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used    = models.BooleanField(default=False)

    def is_expired(self):
        # OTP expires after 5 minutes
        return timezone.now() > self.created_at + timezone.timedelta(minutes=5)

    @staticmethod
    def generate_otp():
        return str(random.randint(100000, 999999))

    def __str__(self):
        return f"{self.user.email} - {self.otp} - {self.method}"