from django.shortcuts import render

def page_view(request,page):
    templates={
        'welcome':'welcome.html',
        'dashboard':'dashboard.html',
        'upload':'upload.html',
        'documents':'document.html',
        'profile':'profile.html',
        'login':'login.html',
        'register':'register.html',
    }

    template_name = templates.get(page, 'welcome.html')
    return render(request, template_name)

