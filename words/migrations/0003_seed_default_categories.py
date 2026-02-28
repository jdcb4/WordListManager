from django.db import migrations


def seed_categories(apps, schema_editor):
    Category = apps.get_model("words", "Category")
    for name in ["Who", "What", "Where"]:
        Category.objects.get_or_create(name=name, defaults={"is_active": True})


def noop(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [
        ("words", "0002_wordentry_ck_guessing_requires_category"),
    ]

    operations = [
        migrations.RunPython(seed_categories, noop),
    ]
