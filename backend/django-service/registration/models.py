from django.db import models


class MemberRegistration(models.Model):
    """
    The full membership application, matching the "Membership Registration
    Form" at the back of the MKDY constitution (Sections A-C). Linked to the
    Node auth service loosely by email (Node owns the login account + the
    eventual membership number).
    """

    class Gender(models.TextChoices):
        FEMALE = 'female', 'Female'
        MALE = 'male', 'Male'

    class MaritalStatus(models.TextChoices):
        SINGLE = 'single', 'Single'
        MARRIED = 'married', 'Married'
        OTHER = 'other', 'Other'

    class Category(models.TextChoices):
        MEMBER = 'member', 'Member'
        LEADER = 'leader', 'Leader'

    class Status(models.TextChoices):
        PENDING_PAYMENT = 'pending_payment', 'Pending Payment'
        ACTIVE = 'active', 'Active'
        SUSPENDED = 'suspended', 'Suspended'

    # Per the constitution (5.2): a single flat annual fee for every member,
    # regardless of category. Kept as a server-side constant so the amount
    # charged can never be tampered with from the frontend.
    ANNUAL_SUBSCRIPTION_FEE = 100

    # ---- Section A: Personal Information ----
    full_name = models.CharField('Full name (as per ID/Baptism Card)', max_length=150)
    national_id = models.CharField('National ID / Birth Certificate No.', max_length=30)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=10, choices=Gender.choices)
    marital_status = models.CharField(max_length=10, choices=MaritalStatus.choices, default=MaritalStatus.SINGLE)
    phone = models.CharField(max_length=20)
    email = models.EmailField(db_index=True)
    postal_address = models.CharField(max_length=150, blank=True)
    residence = models.CharField('Residence (Estate/Village)', max_length=150)
    occupation = models.CharField('Occupation / Student', max_length=150)
    institution = models.CharField('Institution (if student)', max_length=150, blank=True)

    # ---- Section B: Church & Youth Details ----
    parish = models.CharField('Church/Parish', max_length=150)
    is_baptised = models.BooleanField('Baptism status', default=False)
    is_confirmed = models.BooleanField('Confirmation status', default=False)
    other_church_roles = models.CharField(max_length=200, blank=True)
    date_of_joining = models.DateField('Date of joining MKDY', auto_now_add=True)
    membership_category = models.CharField(max_length=10, choices=Category.choices, default=Category.MEMBER)

    # ---- Section C: Next of Kin / Emergency Contact ----
    next_of_kin_name = models.CharField(max_length=150)
    next_of_kin_relationship = models.CharField(max_length=100)
    next_of_kin_phone = models.CharField(max_length=20)
    next_of_kin_alt_phone = models.CharField(max_length=20, blank=True)

    # ---- Payment / membership status ----
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PAYMENT)
    # Filled in once the Node service confirms a membership number was issued.
    membership_number = models.CharField(max_length=30, blank=True, null=True, unique=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.email})"

    @property
    def subscription_amount(self):
        return self.ANNUAL_SUBSCRIPTION_FEE
