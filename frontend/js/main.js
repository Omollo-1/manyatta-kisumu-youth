/* =========================================================
   Manyatta Kisumu Diocese Youth — Shared Front-end Logic
   ========================================================= */

// The public backend URLs used by login, registration, and payments.
var DJANGO_API_BASE = 'https://manyatta-kisumu-youth.onrender.com';
var NODE_API_BASE = 'https://manyatta-kisumu-youth-1.onrender.com';

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Hamburger nav ---------- */
  var burger = document.querySelector('.hamburger');
  var navLinks = document.querySelector('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('open');
      burger.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        burger.classList.remove('open');
      });
    });
  }

  /* ---------- Mark active nav link ---------- */
  var here = (window.location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-links a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === here) a.classList.add('active');
  });

  /* ---------- Gallery lightbox ---------- */
  var lightbox = document.getElementById('lightbox');
  if (lightbox) {
    var lbImg = lightbox.querySelector('img');
    document.querySelectorAll('.gallery-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var src = item.querySelector('img').getAttribute('src');
        var alt = item.querySelector('img').getAttribute('alt') || '';
        lbImg.setAttribute('src', src);
        lbImg.setAttribute('alt', alt);
        lightbox.classList.add('open');
      });
    });
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
        lightbox.classList.remove('open');
      }
    });
  }

  /* ---------- Login / Signup tab switch (login.html) ---------- */
  var tabButtons = document.querySelectorAll('.form-tabs button');
  if (tabButtons.length) {
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(function (p) {
          p.style.display = 'none';
        });
        var target = document.getElementById(btn.dataset.target);
        if (target) target.style.display = 'block';
      });
    });
  }

  /* ---------- Real member login (login.html) ---------- */
  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    var loginAlert = document.getElementById('loginAlert');
    var alreadyIn = document.getElementById('alreadyIn');
    var loginFoot = document.getElementById('loginFoot');
    var loginSubmitBtn = document.getElementById('loginSubmitBtn');

    function showLoggedInState(user) {
      loginForm.style.display = 'none';
      if (loginFoot) loginFoot.style.display = 'none';
      document.getElementById('loggedInName').textContent = user.fullName || user.email;
      alreadyIn.style.display = 'block';
    }

    // If a session cookie is already present (from an earlier login), skip
    // straight to the logged-in state instead of showing the form.
    fetch(NODE_API_BASE + '/api/auth/me', { credentials: 'include' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { if (data && data.user) showLoggedInState(data.user); })
      .catch(function () { /* node-service not running yet — just show the form */ });

    document.getElementById('logoutBtn').addEventListener('click', function () {
      fetch(NODE_API_BASE + '/api/auth/logout', { method: 'POST', credentials: 'include' })
        .finally(function () { window.location.reload(); });
    });

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.textContent = 'Signing in...';
      loginAlert.className = 'alert';

      fetch(NODE_API_BASE + '/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('loginEmail').value.trim(),
          password: document.getElementById('loginPassword').value,
        }),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            loginAlert.className = 'alert alert-error show';
            loginAlert.textContent = result.data.error || 'Could not log in.';
            return;
          }
          loginAlert.className = 'alert alert-success show';
          loginAlert.textContent = 'Signed in! Redirecting...';
          setTimeout(function () { window.location.href = 'index.html'; }, 900);
        })
        .catch(function () {
          loginAlert.className = 'alert alert-error show';
          loginAlert.textContent = 'Could not reach the login service at ' + NODE_API_BASE + '. Is node-service running?';
        })
        .finally(function () {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.textContent = 'Log In';
        });
    });
  }

  /* ---------- Membership signup + real M-Pesa payment (signup.html) ---------- */
  var signupForm = document.getElementById('signupForm');
  if (signupForm) {
    var steps = document.querySelectorAll('.progress-steps .step');
    var panelDetails = document.getElementById('stepDetails');
    var panelPayment = document.getElementById('stepPayment');
    var panelWaiting = document.getElementById('stepWaiting');
    var panelDone = document.getElementById('stepDone');
    var toPaymentBtn = document.getElementById('toPayment');
    var sendStkBtn = document.getElementById('sendStkBtn');
    var backToDetailsBtn = document.getElementById('backToDetails');
    var stkAlert = document.getElementById('stkAlert');
    var registrationId = null;
    var pollTimer = null;
    var isTransitioning = false;

    // Prevent any native form submission completely
    signupForm.addEventListener('submit', function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      return false;
    });

    // Handle Enter key on input fields
    signupForm.querySelectorAll('input, select').forEach(function (field) {
      field.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (isPanelVisible(panelDetails)) {
            toPaymentBtn.click();
          } else if (isPanelVisible(panelPayment)) {
            sendStkBtn.click();
          }
        }
      });
    });

    function isPanelVisible(panel) {
      return !!panel && !panel.hidden && getComputedStyle(panel).display !== 'none';
    }

    function showPanel(panel) {
      [panelDetails, panelPayment, panelWaiting, panelDone].forEach(function (p) {
        if (!p) return;
        p.style.display = 'none';
        p.hidden = true;
      });
      if (panel) {
        panel.style.display = 'block';
        panel.hidden = false;
      }
      document.body.setAttribute('data-signup-step', panel && panel.id || 'details');
      window.scrollTo({ top: signupForm.offsetTop - 110, behavior: 'smooth' });
    }

    function restoreStepFromState() {
      var activeStep = (document.body.getAttribute('data-signup-step') || 'details');
      if (activeStep === 'stepPayment') {
        setStepDots(2);
        showPanel(panelPayment);
      } else if (activeStep === 'stepWaiting') {
        setStepDots(3);
        showPanel(panelWaiting);
      } else if (activeStep === 'stepDone') {
        showPanel(panelDone);
      } else {
        setStepDots(1);
        showPanel(panelDetails);
      }
    }

    function setTransitionState(active) {
      isTransitioning = active;
      if (backToDetailsBtn) {
        backToDetailsBtn.disabled = active;
        backToDetailsBtn.style.opacity = active ? '0.6' : '1';
      }
    }

    window.addEventListener('pageshow', function (event) {
      if (event.persisted || performance.getEntriesByType('navigation')[0] && performance.getEntriesByType('navigation')[0].type === 'back_forward') {
        restoreStepFromState();
      }
    });

    function setStepDots(n) {
      steps.forEach(function (s, i) {
        s.classList.remove('active', 'done');
        if (i < n - 1) s.classList.add('done');
        if (i === n - 1) s.classList.add('active');
      });
    }

    function showAlert(el, message, kind) {
      if (!el) return;
      el.className = 'alert alert-' + kind + ' show';
      el.textContent = message;
    }

    // Turns "0712 345 678" or "+254712345678" into the "2547XXXXXXXX"
    // format Safaricom's Daraja API expects.
    function normalizeKenyanPhone(raw) {
      var digits = (raw || '').replace(/\D/g, '');
      if (digits.startsWith('0')) digits = '254' + digits.slice(1);
      else if (digits.startsWith('7') || digits.startsWith('1')) digits = '254' + digits;
      return digits;
    }

    // --- Step 1 -> 2: Validate details & submit to Django + Node in background ---
    toPaymentBtn.addEventListener('click', function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (isTransitioning) return;

      // ── Validate all required fields ──────────────────────────────────────
      var required = signupForm.querySelectorAll('#stepDetails [required]');
      var ok = true;
      required.forEach(function (f) {
        if (!f.value.trim()) { ok = false; f.style.borderColor = '#B3261E'; }
        else { f.style.borderColor = ''; }
      });
      if (!ok) { alert('Please fill in all required fields highlighted in red.'); return; }

      var password = document.getElementById('password').value;
      var confirmPassword = document.getElementById('confirmPassword').value;
      if (password !== confirmPassword) {
        alert("Passwords don't match — please re-enter them.");
        return;
      }
      if (password.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
      }

      var fullName = document.getElementById('fullName').value.trim();
      var email = document.getElementById('email').value.trim();
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        alert('Please enter a valid email address (e.g. user@example.com).');
        document.getElementById('email').focus();
        document.getElementById('email').style.borderColor = '#B3261E';
        return;
      }

      var rawPhone = document.getElementById('phone').value.trim();
      var normalizedPhone = normalizeKenyanPhone(rawPhone);

      var registrationPayload = {
        full_name: fullName,
        national_id: document.getElementById('nationalId').value.trim(),
        date_of_birth: document.getElementById('dob').value,
        gender: document.getElementById('gender').value,
        marital_status: document.getElementById('maritalStatus').value,
        phone: normalizedPhone,
        email: email,
        postal_address: (document.getElementById('postalAddress').value || '').trim(),
        residence: document.getElementById('residence').value.trim(),
        occupation: document.getElementById('occupation').value.trim(),
        institution: (document.getElementById('institution').value || '').trim(),
        parish: document.getElementById('parish').value.trim(),
        is_baptised: document.getElementById('baptismStatus').value === 'yes',
        is_confirmed: document.getElementById('confirmationStatus').value === 'yes',
        other_church_roles: (document.getElementById('otherRoles').value || '').trim(),
        membership_category: document.getElementById('memberType').value || 'member',
        next_of_kin_name: document.getElementById('kinName').value.trim(),
        next_of_kin_relationship: document.getElementById('kinRelationship').value.trim(),
        next_of_kin_phone: normalizeKenyanPhone(document.getElementById('kinPhone').value.trim()),
        next_of_kin_alt_phone: (document.getElementById('kinAltPhone').value || '').trim(),
      };

      setStepDots(2);
      showPanel(panelPayment);
      document.getElementById('amountDue').textContent = 'KES 100';
      document.getElementById('mpesaPhone').value = rawPhone;
      sendStkBtn.disabled = true;
      setTransitionState(true);
      showAlert(stkAlert, 'Saving your details… please wait a moment.', 'info');

      fetch(NODE_API_BASE + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName, email: email, password: password }),
      })
        .then(function (res) {
          if (res.status === 409) return Promise.resolve();
          if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || 'Account creation failed.'); });
          return Promise.resolve();
        })
        .then(function () {
          return fetch(DJANGO_API_BASE + '/api/registration/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationPayload),
          });
        })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (d) {
            var msg = typeof d === 'object' ? Object.values(d).flat().join(' ') : JSON.stringify(d);
            throw new Error(msg);
          });
          return res.json();
        })
        .then(function (data) {
          registrationId = data.id;
          document.getElementById('amountDue').textContent = 'KES ' + data.subscription_amount;
          sendStkBtn.disabled = false;
          setTransitionState(false);
          stkAlert.className = 'alert';
        })
        .catch(function (err) {
          setTransitionState(false);
          sendStkBtn.disabled = false;
          var msg = (err && err.message) ? err.message : String(err);
          showAlert(stkAlert, 'Could not save your details: ' + msg + ' — verify both backends are running, then click Back to adjust if needed.', 'error');
        });
    });

    if (backToDetailsBtn) {
      backToDetailsBtn.addEventListener('click', function (e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (isTransitioning) return;
        setStepDots(1);
        showPanel(panelDetails);
      });
    }

    // --- Step 2: send STK push via Django -> Safaricom Daraja ---
    sendStkBtn.addEventListener('click', function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (!registrationId) {
        showAlert(stkAlert, 'Still saving your details — please wait a few seconds and try again.', 'info');
        return;
      }

      var phoneRaw = document.getElementById('mpesaPhone').value.trim();
      if (!phoneRaw) {
        showAlert(stkAlert, 'Enter the phone number to send the prompt to.', 'error');
        return;
      }
      var phone = normalizeKenyanPhone(phoneRaw);

      sendStkBtn.disabled = true;
      sendStkBtn.textContent = 'Sending...';
      stkAlert.className = 'alert';
      setTransitionState(true);

      fetch(DJANGO_API_BASE + '/api/payments/mpesa/stkpush/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: registrationId, phone: phone }),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          if (!result.ok) {
            setTransitionState(false);
            showAlert(stkAlert, result.data.error || 'Could not send the STK push.', 'error');
            return;
          }
          setStepDots(3);
          showPanel(panelWaiting);
          startPolling();
        })
        .catch(function () {
          setTransitionState(false);
          showAlert(stkAlert, 'Could not reach the Django backend at ' + DJANGO_API_BASE + '. Is it running?', 'error');
        })
        .finally(function () {
          sendStkBtn.disabled = false;
          setTransitionState(false);
          sendStkBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01" stroke-linecap="round"/></svg>Send M-Pesa Prompt';
        });
    });

    // --- Poll until Django confirms payment and Node has issued a membership number ---
    function startPolling() {
      var attempts = 0;
      var waitingNote = document.getElementById('waitingNote');
      if (pollTimer) clearInterval(pollTimer);

      pollTimer = setInterval(function () {
        attempts++;
        fetch(DJANGO_API_BASE + '/api/registration/' + registrationId + '/')
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.status === 'active' && data.membership_number) {
              clearInterval(pollTimer);
              document.getElementById('memberDisplayName').textContent = data.full_name;
              document.getElementById('membershipNumber').textContent = data.membership_number;
              showPanel(panelDone);
            } else if (attempts >= 25) {
              clearInterval(pollTimer);
              waitingNote.textContent = "Still waiting on confirmation. If you entered your PIN and this hasn't updated, check the server logs — Safaricom's callback needs a public URL (e.g. via ngrok) to reach your machine in live sandbox mode.";
            }
          })
          .catch(function () {
            // transient network hiccup — continue polling
          });
      }, 3000);
    }
  }

  /* ---------- Image Carousel Logic ---------- */
  var carousel = document.querySelector('.carousel-wrapper');
  if (carousel) {
    var track = carousel.querySelector('.carousel-track');
    var slides = carousel.querySelectorAll('.carousel-slide');
    var prevBtn = carousel.querySelector('.carousel-btn.prev');
    var nextBtn = carousel.querySelector('.carousel-btn.next');
    var dotsContainer = carousel.querySelector('.carousel-dots');

    if (slides.length > 0) {
      var currentIndex = 0;
      var slideCount = slides.length;
      var autoTimer = null;

      // Create dots
      dotsContainer.innerHTML = '';
      for (var i = 0; i < slideCount; i++) {
        var dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.dataset.index = i;
        dotsContainer.appendChild(dot);
      }
      var dots = dotsContainer.querySelectorAll('.carousel-dot');

      function goToSlide(index) {
        if (index < 0) index = slideCount - 1;
        if (index >= slideCount) index = 0;
        currentIndex = index;
        track.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
        dots.forEach(function (d, idx) {
          d.classList.toggle('active', idx === currentIndex);
        });
      }

      function startAutoSlide() {
        stopAutoSlide();
        autoTimer = setInterval(function () {
          goToSlide(currentIndex + 1);
        }, 5000);
      }

      function stopAutoSlide() {
        if (autoTimer) clearInterval(autoTimer);
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          goToSlide(currentIndex - 1);
          startAutoSlide();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          goToSlide(currentIndex + 1);
          startAutoSlide();
        });
      }

      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          goToSlide(parseInt(dot.dataset.index, 10));
          startAutoSlide();
        });
      });

      carousel.addEventListener('mouseenter', stopAutoSlide);
      carousel.addEventListener('mouseleave', startAutoSlide);

      startAutoSlide();
    }
  }

  /* ---------- Team Wing Filter & Search ---------- */
  var memberSearchInput = document.getElementById('memberSearch');
  var wingTabButtons = document.querySelectorAll('.wing-tab-btn');
  var memberCards = document.querySelectorAll('.member-card');

  if (memberCards.length > 0) {
    var activeWing = 'all';

    function filterMembers() {
      var query = memberSearchInput ? memberSearchInput.value.toLowerCase().trim() : '';

      memberCards.forEach(function (card) {
        var wing = card.dataset.wing || '';
        var name = (card.dataset.name || card.textContent).toLowerCase();
        var id = (card.dataset.id || '').toLowerCase();

        var matchesWing = (activeWing === 'all' || wing === activeWing);
        var matchesQuery = !query || name.includes(query) || id.includes(query);

        if (matchesWing && matchesQuery) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    }

    if (wingTabButtons.length > 0) {
      wingTabButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          wingTabButtons.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          activeWing = btn.dataset.wing;
          filterMembers();
        });
      });
    }

    if (memberSearchInput) {
      memberSearchInput.addEventListener('input', filterMembers);
    }
  }

  /* ---------- Gallery Category Filters ---------- */
  var galleryFilterBtns = document.querySelectorAll('.gallery-filter-btn');
  var galleryItems = document.querySelectorAll('.gallery-grid .gallery-item');

  if (galleryFilterBtns.length > 0 && galleryItems.length > 0) {
    galleryFilterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        galleryFilterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var category = btn.dataset.category;

        galleryItems.forEach(function (item) {
          var itemCategory = item.dataset.category || 'all';
          if (category === 'all' || itemCategory === category) {
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

});

