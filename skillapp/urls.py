from django.urls import path
from . import views

urlpatterns=[
    path('',views.page_view,{'page':'welcome'},name='welcome'),
    path('dashboard/',views.page_view,{'page':'dashboard'},name='dashboard'),
    path('upload/',views.page_view,{'page':'upload'},name='upload.html'),
    path('documents/',views.page_view,{'page':'documents'},name='documents'),
    path('profile/',views.page_view,{'page':'profile'},name='profile'),   
    path('login/',views.page_view,{'page':'login'},name='login'),
    path('register/',views.page_view,{'page':'register'},name='register'),]