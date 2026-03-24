from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Document


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display   = ("email", "full_name", "phone", "is_active", "date_joined")
    search_fields  = ("email", "full_name", "phone")
    ordering       = ("-date_joined",)
    list_filter    = ("is_active", "is_staff", "gender")
    fieldsets = (
        ("Login",    {"fields": ("email", "password")}),
        ("Profile",  {"fields": (
            "full_name", "student_id", "phone", "gender",
            "date_of_birth", "nationality", "address", "bio", "profile_photo",
        )}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",),
                "fields": ("email", "full_name", "password1", "password2")}),
    )
    filter_horizontal = ()


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display   = ("title", "owner", "category", "tags", "file_type",
                      "file_size_display", "uploaded_at")
    list_filter    = ("category", "tags", "file_type", "status")
    search_fields  = ("title", "description", "owner__email")
    readonly_fields = ("file_name", "file_size", "file_type",
                       "uploaded_at", "updated_at")
    date_hierarchy = "uploaded_at"
    ordering       = ("-uploaded_at",)

    def file_size_display(self, obj):
        return obj.file_size_display
    file_size_display.short_description = "Size"