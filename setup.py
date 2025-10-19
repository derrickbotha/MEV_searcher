#!/usr/bin/env python
"""
MEV Dashboard Setup Script
Handles database setup and initial configuration
"""
import os
import sys
import subprocess
import platform
from pathlib import Path

def run_command(command, shell=False):
    """Run a command and return success status"""
    try:
        result = subprocess.run(command, shell=shell, capture_output=True, text=True)
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def setup_postgresql():
    """Set up PostgreSQL database"""
    print("🔧 Setting up PostgreSQL database...")

    system = platform.system().lower()

    if system == "windows":
        # Check if PostgreSQL is installed
        success, stdout, stderr = run_command(["where", "psql"])
        if not success:
            print("❌ PostgreSQL not found. Please install PostgreSQL:")
            print("   1. Download from: https://www.postgresql.org/download/windows/")
            print("   2. Install with default settings")
            print("   3. Make sure psql is in your PATH")
            return False

        # Create database and user
        print("📦 Creating database and user...")
        commands = [
            'psql -U postgres -c "CREATE DATABASE mev_dashboard;"',
            'psql -U postgres -c "CREATE USER mev_user WITH PASSWORD \'mev_password\';"',
            'psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE mev_dashboard TO mev_user;"'
        ]

        for cmd in commands:
            success, stdout, stderr = run_command(cmd, shell=True)
            if not success:
                print(f"⚠️  Command failed: {cmd}")
                print(f"   Error: {stderr}")
                # Continue anyway, user might have different setup

    elif system == "linux":
        # Linux setup
        print("🐧 Linux PostgreSQL setup...")
        commands = [
            "sudo -u postgres createdb mev_dashboard",
            "sudo -u postgres psql -c \"CREATE USER mev_user WITH PASSWORD 'mev_password';\"",
            "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE mev_dashboard TO mev_user;\""
        ]

        for cmd in commands:
            success, stdout, stderr = run_command(cmd, shell=True)
            if not success:
                print(f"⚠️  Command failed: {cmd}")
                print(f"   Error: {stderr}")

    else:
        print(f"⚠️  Unsupported operating system: {system}")
        print("   Please manually set up PostgreSQL database 'mev_dashboard'")
        print("   with user 'mev_user' and password 'mev_password'")
        return False

    print("✅ PostgreSQL setup completed!")
    return True

def setup_redis():
    """Set up Redis"""
    print("🔧 Setting up Redis...")

    system = platform.system().lower()

    if system == "windows":
        # Check if Redis is installed
        success, stdout, stderr = run_command(["where", "redis-server"])
        if not success:
            print("❌ Redis not found. Please install Redis:")
            print("   1. Download from: https://redis.io/download")
            print("   2. Or use Chocolatey: choco install redis-64")
            print("   3. Make sure redis-server is in your PATH")
            return False

        print("✅ Redis found!")

    elif system == "linux":
        # Check if Redis is running
        success, stdout, stderr = run_command("systemctl is-active redis", shell=True)
        if not success:
            print("⚠️  Redis service not running. Starting Redis...")
            run_command("sudo systemctl start redis", shell=True)
            run_command("sudo systemctl enable redis", shell=True)

    print("✅ Redis setup completed!")
    return True

def main():
    """Main setup function"""
    print("🚀 MEV Dashboard Setup")
    print("=" * 50)

    # Change to project directory
    project_dir = Path(__file__).parent
    os.chdir(project_dir)

    # Setup database
    if not setup_postgresql():
        print("⚠️  PostgreSQL setup had issues, but continuing...")

    # Setup Redis
    if not setup_redis():
        print("⚠️  Redis setup had issues, but continuing...")

    # Run Django migrations
    print("📦 Running Django migrations...")
    success, stdout, stderr = run_command([sys.executable, "manage.py", "migrate"])
    if success:
        print("✅ Database migrations completed!")
    else:
        print("❌ Migration failed:")
        print(stderr)
        return False

    # Create superuser
    print("👤 Creating Django superuser...")
    print("   Username: admin")
    print("   Email: admin@mev.local")
    print("   Password: admin123")

    # Create superuser non-interactively
    env = os.environ.copy()
    env['DJANGO_SUPERUSER_USERNAME'] = 'admin'
    env['DJANGO_SUPERUSER_EMAIL'] = 'admin@mev.local'
    env['DJANGO_SUPERUSER_PASSWORD'] = 'admin123'

    success, stdout, stderr = run_command(
        [sys.executable, "manage.py", "createsuperuser", "--noinput"],
        env=env
    )

    if success:
        print("✅ Superuser created!")
    else:
        print("⚠️  Superuser creation failed (might already exist)")

    print("\n🎉 Setup completed!")
    print("\nNext steps:")
    print("1. Start Redis: redis-server")
    print("2. Start Django: python manage.py runserver")
    print("3. Visit: http://localhost:8000")
    print("4. Login with: admin / admin123")
    print("\nFor production:")
    print("- Update settings.py with production database credentials")
    print("- Set DEBUG = False")
    print("- Configure proper SECRET_KEY")
    print("- Set up proper static file serving")

if __name__ == "__main__":
    main()