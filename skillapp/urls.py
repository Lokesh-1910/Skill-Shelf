from django.urls import path
from . import views

urlpatterns = [
    # Public
    path('',views.page_view,   {'page': 'welcome'}, name='welcome'),
    path('register/',views.register_view,name='register'),
    path('login/',views.login_view, name='login'),
    path('logout/',views.logout_view,name='logout'),

    # Protected — user pages
    path('dashboard/',views.dashboard_view,name='dashboard'),
    path('upload/',views.upload_view,name='upload'),
    path('documents/',views.documents_view,name='documents'),
    path('profile/',views.profile_view,name='profile'),

    # Document actions
    path('documents/<int:doc_id>/',views.document_detail_view,name='document_detail'),
    path('upload/ajax/',views.upload_ajax_view,name='upload_ajax'),
    path('documents/<int:doc_id>/download/',views.document_download_view,name='document_download'),
    path('documents/<int:doc_id>/delete/',views.document_delete_view,name='document_delete'),
    path('send-otp/',   views.send_otp_view,   name='send_otp'),
    path('verify-otp/', views.verify_otp_view, name='verify_otp'),
    path('resend-otp/', views.resend_otp_view, name='resend_otp'),

    path('chat/',               views.chat_view,        name='chat'),
    path('api/chat/',           views.chat_api,         name='chat_api'),
    path('api/chat/history/',   views.chat_history_api, name='chat_history_api'),
    path('api/chat/clear/',     views.chat_clear_api,   name='chat_clear_api'),
    path('documents/passcode/', views.verify_doc_passcode, name='doc_passcode'),
    path('verify-otp-only/', views.verify_otp_only, name='verify_otp_only'),
]