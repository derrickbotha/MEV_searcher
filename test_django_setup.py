#!/usr/bin/env python
"""
Django setup verification script
"""
import os
import sys
import django
from django.conf import settings

# Add the project directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

# Configure Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mev_dashboard.settings')

try:
    django.setup()
    print("✅ Django setup successful!")

    # Test imports
    from django.apps import apps
    print("✅ Django apps loaded successfully!")

    # List installed apps
    installed_apps = [app.label for app in apps.get_app_configs()]
    print(f"✅ Installed apps: {', '.join(installed_apps)}")

    # Test database connection (will fail without PostgreSQL, but that's expected)
    from django.db import connection
    try:
        cursor = connection.cursor()
        print("✅ Database connection configured")
    except Exception as e:
        print(f"⚠️  Database connection not available: {e}")

    print("\n🎉 Django project structure created successfully!")
    print("Next steps:")
    print("1. Set up PostgreSQL database")
    print("2. Set up Redis server")
    print("3. Run 'python manage.py migrate'")
    print("4. Create superuser: 'python manage.py createsuperuser'")
    print("5. Run development server: 'python manage.py runserver'")

except Exception as e:
    print(f"❌ Django setup failed: {e}")
    sys.exit(1)