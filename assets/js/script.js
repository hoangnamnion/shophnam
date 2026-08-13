
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());

        gtag('config', 'G-13L22WZHY8');
    

        document.addEventListener('DOMContentLoaded', function () {
            const loader = document.getElementById('global-loader');
            if (!loader) return;
            loader.classList.add('fade-out');
            loader.style.opacity = '0';
            loader.style.pointerEvents = 'none';
            window.setTimeout(function () {
                loader.style.display = 'none';
            }, 200);
        });
        
        // Fallback
        window.setTimeout(function () {
            const loader = document.getElementById('global-loader');
            if (loader) {
                loader.classList.add('fade-out');
                loader.style.opacity = '0';
                loader.style.pointerEvents = 'none';
                loader.style.display = 'none';
            }
        }, 500);
    

            // Fake Flash Sale Timer Logic
            document.addEventListener('DOMContentLoaded', () => {
                const now = new Date();
                const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                let timeLeft = Math.floor((endOfDay - now) / 1000); 
                
                const loopTime = 3 * 3600; // 3 hours loop
                timeLeft = timeLeft % loopTime;
                if (timeLeft < 1800) timeLeft += 3600; 
                
                let slots = localStorage.getItem('fs_slots');
                if (!slots || slots < 3 || slots > 20) {
                    slots = Math.floor(Math.random() * 5) + 12; // 12-16
                }
                localStorage.setItem('fs_slots', slots);
                const slotsEl = document.getElementById('slots-left');
                if(slotsEl) slotsEl.textContent = slots;
                
                setInterval(() => {
                    if (slots > 2) {
                        slots--;
                        localStorage.setItem('fs_slots', slots);
                        if(slotsEl) {
                            slotsEl.style.transform = 'scale(1.2)';
                            slotsEl.style.transition = 'all 0.3s';
                            slotsEl.textContent = slots;
                            setTimeout(() => slotsEl.style.transform = 'scale(1)', 300);
                        }
                    }
                }, Math.floor(Math.random() * 45000) + 20000); // Drop a slot every 20-65s
                
                const hEl = document.getElementById('fs-hours');
                const mEl = document.getElementById('fs-minutes');
                const sEl = document.getElementById('fs-seconds');
                
                setInterval(() => {
                    timeLeft--;
                    if (timeLeft < 0) timeLeft = loopTime;
                    
                    const h = Math.floor(timeLeft / 3600);
                    const m = Math.floor((timeLeft % 3600) / 60);
                    const s = timeLeft % 60;
                    
                    if(hEl) hEl.textContent = h.toString().padStart(2, '0');
                    if(mEl) mEl.textContent = m.toString().padStart(2, '0');
                    if(sEl) sEl.textContent = s.toString().padStart(2, '0');
                }, 1000);
            });
        

            document.addEventListener('DOMContentLoaded', function() {
                // Set initial glider position
                const allBtn = document.getElementById('btn-filter-all');
                if(allBtn) {
                    const glider = document.getElementById('filter-glider');
                    glider.style.width = allBtn.offsetWidth + 'px';
                    glider.style.transform = `translateX(${allBtn.offsetLeft - 6}px)`;
                }

                window.pricingSwiper = new Swiper(".pricingSwiper", {
                    slidesPerView: 1.15,
                    spaceBetween: 16,
                    centeredSlides: true,
                    initialSlide: 1, // Start at the second plan (usually the popular one)
                    autoplay: {
                        delay: 3500,
                        disableOnInteraction: true,
                        pauseOnMouseEnter: true
                    },
                    pagination: {
                        el: ".swiper-pagination",
                        clickable: true,
                    },
                    breakpoints: {
                        640: {
                            slidesPerView: 2,
                            spaceBetween: 20,
                            centeredSlides: false,
                            initialSlide: 0,
                        },
                        1024: {
                            slidesPerView: 3,
                            spaceBetween: 24,
                            centeredSlides: false,
                            initialSlide: 0,
                            autoplay: false, // Tắt tự động lướt trên desktop vì đã hiện đủ 3 gói
                        },
                    },
                });
            });

            function filterOS(os, btnEl) {
                if (!btnEl) btnEl = document.getElementById('btn-filter-' + os);

                // Animate Glider
                const glider = document.getElementById('filter-glider');
                glider.style.width = btnEl.offsetWidth + 'px';
                glider.style.transform = `translateX(${btnEl.offsetLeft - 6}px)`; // -6px for the parent padding left

                // update button styles
                document.querySelectorAll('[id^="btn-filter-"]').forEach(btn => {
                    btn.classList.remove('font-extrabold', 'text-white', 'hover:text-white');
                    btn.classList.add('font-bold', 'text-gray-500', 'hover:text-gray-700');
                });
                btnEl.classList.remove('font-bold', 'text-gray-500', 'hover:text-gray-700');
                btnEl.classList.add('font-extrabold', 'text-white', 'hover:text-white');

                // update icons color
                document.querySelectorAll('[id^="icon-"]').forEach(icon => {
                    icon.classList.add('grayscale', 'opacity-60');
                });
                if (os !== 'all') {
                    const activeIcon = document.getElementById('icon-' + os);
                    if(activeIcon) activeIcon.classList.remove('grayscale', 'opacity-60');
                }

                // filter slides
                const slides = document.querySelectorAll('.pricingSwiper .swiper-slide');
                let visibleCount = 0;
                
                slides.forEach(slide => {
                    const supported = slide.getAttribute('data-os') || 'both'; 
                    if (os === 'all') {
                        slide.style.display = 'flex';
                        visibleCount++;
                    } else if (os === 'ios') {
                        if (supported === 'ios' || supported === 'both') {
                            slide.style.display = 'flex';
                            visibleCount++;
                        } else {
                            slide.style.display = 'none';
                        }
                    } else if (os === 'android') {
                        if (supported === 'android' || supported === 'both') {
                            slide.style.display = 'flex';
                            visibleCount++;
                        } else {
                            slide.style.display = 'none';
                        }
                    }
                });

                const emptyMsg = document.getElementById('empty-plans-msg');
                const swiperWrapper = document.querySelector('.pricingSwiper .swiper-wrapper');
                const pagination = document.getElementById('pricing-pagination');

                if (visibleCount === 0) {
                    emptyMsg.style.display = 'flex';
                    emptyMsg.classList.remove('hidden');
                    swiperWrapper.style.display = 'none';
                    if(pagination) pagination.style.display = 'none';
                } else {
                    emptyMsg.style.display = 'none';
                    emptyMsg.classList.add('hidden');
                    swiperWrapper.style.display = 'flex';
                    if(pagination) pagination.style.display = 'block';
                }
                
                if (window.pricingSwiper) {
                    window.pricingSwiper.update();
                    window.pricingSwiper.slideTo(0);
                }
            }
        

    let payPollInterval = null;
    let qrTimerInterval = null;
    let currentVoucher = null;
    let currentPlanId = null;
    let currentPlanOs = 'both';
    let currentAmount = 0;
    let currentFinalAmount = 0;
    let isProcessingPayment = false;
    let pendingAction = null;

    function showConfirmDialog(actionCallback) {
        pendingAction = actionCallback;
        const overlay = document.getElementById('confirmOverlay');
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    function hideConfirmDialog() {
        pendingAction = null;
        const overlay = document.getElementById('confirmOverlay');
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
    }

    document.getElementById('confirmYesBtn')?.addEventListener('click', function() {
        if (pendingAction) {
            isProcessingPayment = false;
            pendingAction();
            hideConfirmDialog();
        }
    });

    window.addEventListener('beforeunload', function (e) {
        if (isProcessingPayment) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    const PAY_API = 'https://locketduongbinhshop.vercel.app';
    const PAY_BANK = 'MB';
    const PAY_ACC = '0567355688888';
    const PAY_NAME = 'DO DUONG BINH';

    function startQrCountdown() {
        let timeLeft = 300; // 5 phút
        const countdownEl = document.getElementById('qrCountdown');
        countdownEl.textContent = '05:00';
        countdownEl.classList.remove('animate-pulse');
        
        const waitEl = document.getElementById('payStatusWait');
        waitEl.innerHTML = '<div class="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div> Đang chờ thanh toán...';
        waitEl.className = 'mt-4 flex items-center justify-center gap-2 py-3 bg-blue-50 rounded-xl text-blue-700 text-sm font-semibold';
        
        if (qrTimerInterval) clearInterval(qrTimerInterval);
        
        qrTimerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(qrTimerInterval);
                if (payPollInterval) clearInterval(payPollInterval);
                countdownEl.textContent = "ĐÃ HẾT HẠN";
                countdownEl.classList.add('animate-pulse');
                waitEl.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Mã QR đã hết hạn. Vui lòng tạo lại.';
                waitEl.className = 'mt-4 flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold';
            } else {
                const m = Math.floor(timeLeft / 60);
                const s = timeLeft % 60;
                countdownEl.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
            }
        }, 1000);
    }

    window.openPayment = function(planId, planName, price, duration, os) {
        // Lấy locket username đã kiểm tra (nếu có)
        const locketUser = window.verifiedLocketUser;
        const username = locketUser ? (locketUser.username || '') : '';

        const numPrice = parseInt(String(price).replace(/[^0-9]/g, '')) || 0;

        const params = new URLSearchParams({
            planId:   planId   || '',
            plan:     planName || '',
            price:    numPrice,
            final:    numPrice,
            duration: duration || '',
            os:       os       || 'both',
        });
        if (username) params.set('username', username);

        window.location.href = '/upgrade/?' + params.toString();
    };
    function openPayment(planId, planName, price, duration, os) {
        window.openPayment(planId, planName, price, duration, os);
    }

    // Modal Username Checker
    window.checkLocketUserModal = async function() {
        const input = document.getElementById('locketUsernameInput');
        const btn = document.getElementById('checkLocketUserBtn');
        const preview = document.getElementById('locketUserPreview');
        const msg = document.getElementById('locketUserMsg');

        let raw = input ? input.value.trim() : '';
        if (!raw) {
            if (msg) {
                msg.textContent = '❌ Vui lòng nhập Username hoặc link Locket!';
                msg.style.color = '#dc2626';
                msg.classList.remove('hidden');
            }
            return;
        }

        // Auto extract from URL
        if (raw.includes('locket.cam/')) {
            const m = raw.match(/locket\.cam\/(@?[a-zA-Z0-9_.-]+)/);
            if (m && m[1]) raw = m[1].replace('@', '');
        }

        btn.disabled = true;
        const oldText = btn.textContent;
        btn.textContent = '⌛ ...';
        if (preview) preview.classList.add('hidden');
        if (msg) msg.classList.add('hidden');

        try {
            const info = await window.lookupLocketUsername(raw);
            if (info && info.success) {
                window.verifiedLocketUser = info;
                document.getElementById('locketUserName').textContent = info.name || raw;
                document.getElementById('locketUserHandle').textContent = '@' + (info.username || raw);
                document.getElementById('locketUserAvatar').src = info.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(info.name || raw)}&background=f59e0b&color=fff&bold=true`;
                if (preview) preview.classList.remove('hidden');
            } else {
                window.verifiedLocketUser = null;
                if (msg) {
                    msg.textContent = '❌ ' + ((info && info.error) || 'Không tìm thấy tài khoản Locket này!');
                    msg.style.color = '#dc2626';
                    msg.classList.remove('hidden');
                }
            }
        } catch(e) {
            window.verifiedLocketUser = null;
            if (msg) {
                msg.textContent = '❌ Lỗi kết nối kiểm tra tài khoản.';
                msg.style.color = '#dc2626';
                msg.classList.remove('hidden');
            }
        }
        btn.disabled = false;
        btn.textContent = oldText;
    };

    async function applyVoucher() {
        const code = document.getElementById('voucherInput').value.trim();
        const msg = document.getElementById('voucherMsg');
        const btn = document.getElementById('voucherBtn');

        if (!code) { showVoucherMsg('Vui lòng nhập mã giảm giá.', false); return; }

        btn.disabled = true; btn.textContent = '...';
        try {
            const res = await fetch(PAY_API + '/api/voucher/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'mPPpN7Ke2b6U83o27RFJG2U5TnkyAmXwT5PbTkvI' },
                body: JSON.stringify({ code, plan_id: currentPlanId, amount: currentAmount })
            });
            const data = await res.json();

            if (data.valid) {
                currentVoucher = data;
                currentFinalAmount = data.final_price;
                document.getElementById('s1DiscountRow').classList.remove('hidden');
                document.getElementById('s1Discount').textContent = '-' + data.discount.toLocaleString('vi-VN') + 'đ';
                document.getElementById('s1FinalPrice').textContent = data.final_price.toLocaleString('vi-VN') + 'đ';
                showVoucherMsg(data.message, true);
            } else {
                currentVoucher = null;
                currentFinalAmount = currentAmount;
                document.getElementById('s1DiscountRow').classList.add('hidden');
                document.getElementById('s1FinalPrice').textContent = currentAmount.toLocaleString('vi-VN') + 'đ';
                showVoucherMsg(data.message, false);
            }
        } catch(e) {
            showVoucherMsg('Lỗi kết nối.', false);
        }
        btn.disabled = false; btn.textContent = 'Áp dụng';
    }

    function showVoucherMsg(text, success) {
        const msg = document.getElementById('voucherMsg');
        const icon = success ? '<svg class="w-3.5 h-3.5 inline mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : '<svg class="w-3.5 h-3.5 inline mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        msg.innerHTML = icon + ' ' + text;
        msg.style.color = success ? '#16a34a' : '#dc2626';
        msg.classList.remove('hidden');
    }

    window.goToStep2 = function() {
        if (!currentPlanId) return;

        const locketInp = document.getElementById('locketUsernameInput');
        const msg = document.getElementById('locketUserMsg');
        const locketUsername = locketInp ? locketInp.value.trim() : '';

        if (!locketUsername) {
            if (msg) {
                msg.textContent = '⚠️ Vui lòng nhập Username Locket và bấm "Kiểm tra" trước khi thanh toán!';
                msg.style.color = '#dc2626';
                msg.classList.remove('hidden');
            }
            if (locketInp) locketInp.focus();
            return;
        }

        if (!window.verifiedLocketUser) {
            if (msg) {
                msg.textContent = '⚠️ Vui lòng bấm nút "Kiểm tra" để xác nhận tài khoản Locket hợp lệ!';
                msg.style.color = '#d97706';
                msg.classList.remove('hidden');
            }
            return;
        }

        let userCode = 'KH';
        try {
            const uStr = localStorage.getItem('user');
            if (uStr) {
                const u = JSON.parse(uStr);
                userCode = u.username || u.name || u.email || 'KH';
            }
        } catch(e) {}

        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        const memo = `LK ${userCode} ${randSuffix}`.toUpperCase();
        const amount = currentFinalAmount || currentAmount;

        const payBankEl = document.getElementById('payBank');
        if (payBankEl) payBankEl.textContent = 'MB Bank (' + PAY_BANK + ')';

        const payAccNoEl = document.getElementById('payAccNo');
        if (payAccNoEl) payAccNoEl.textContent = PAY_ACC;

        const payAccNameEl = document.getElementById('payAccName');
        if (payAccNameEl) payAccNameEl.textContent = PAY_NAME;

        const payAmountEl = document.getElementById('payAmount');
        if (payAmountEl) payAmountEl.textContent = amount.toLocaleString('vi-VN') + 'đ';

        const payContentEl = document.getElementById('payContent');
        if (payContentEl) payContentEl.textContent = memo;

        const qrUrl = `https://img.vietqr.io/image/${PAY_BANK}-${PAY_ACC}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(PAY_NAME)}`;
        const qrImg = document.getElementById('payQrImg');
        if (qrImg) qrImg.src = qrUrl;

        document.getElementById('payStep1')?.classList.add('hidden');
        document.getElementById('payStep2')?.classList.remove('hidden');

        isProcessingPayment = true;
        startQrCountdown();
    };
    function goToStep2() {
        window.goToStep2();
    }

    function backToStep1() {
        const action = () => {
            if (payPollInterval) clearInterval(payPollInterval);
            if (qrTimerInterval) clearInterval(qrTimerInterval);
            document.getElementById('payStep2').classList.add('hidden');
            document.getElementById('payStep1').classList.remove('hidden');
        };
        
        if (isProcessingPayment) {
            showConfirmDialog(action);
            return;
        }
        action();
    }

    function closePayment() {
        const action = () => {
            if (payPollInterval) clearInterval(payPollInterval);
            if (qrTimerInterval) clearInterval(qrTimerInterval);
            const overlay = document.getElementById('paymentOverlay');
            overlay.style.display = 'none';
            overlay.classList.add('hidden');
        };
        
        if (isProcessingPayment) {
            showConfirmDialog(action);
            return;
        }
        action();
    }

    document.getElementById('paymentOverlay')?.addEventListener('click', function(e) {
        if (e.target === this) closePayment();
    });

    function copyVal(id, btn) {
        const text = document.getElementById(id).textContent;
        navigator.clipboard.writeText(text).then(() => {
            const copyIcon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
            const checkIcon = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
            btn.innerHTML = checkIcon;
            setTimeout(() => btn.innerHTML = copyIcon, 2000);
        });
    }

    function showCongrats(planName, amount, duration, os) {
        currentPlanOs = os || 'both';
        document.getElementById('congratsPlanName').textContent = planName;
        document.getElementById('congratsAmount').textContent = (amount || 0).toLocaleString('vi-VN') + 'đ';
        document.getElementById('congratsDuration').textContent = duration || '';
        const overlay = document.getElementById('congratsOverlay');
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        let sec = 5;
        const countEl = document.getElementById('congratsCountdown');
        const timer = setInterval(() => {
            sec--;
            if (countEl) countEl.textContent = sec;
            if (sec <= 0) { 
                clearInterval(timer); 
                redirectAfterPurchase();
            }
        }, 1000);
    }

    function closeCongrats() {
        document.getElementById('congratsOverlay').style.display = 'none';
        redirectAfterPurchase();
    }

    function redirectAfterPurchase() {
        window.location.href = '/activate';
    }


                document.addEventListener('DOMContentLoaded', function () {
                    new Swiper(".featureSwiper", {
                        slidesPerView: 1.5,
                        spaceBetween: 16,
                        loop: true,
                        autoplay: {
                            delay: 2500,
                            disableOnInteraction: false,
                        },
                        pagination: {
                            el: ".swiper-pagination",
                            clickable: true,
                        },
                        breakpoints: {
                            480: { slidesPerView: 2.5, spaceBetween: 16 },
                            768: { slidesPerView: 3.5, spaceBetween: 20 },
                            1024: { slidesPerView: 4, spaceBetween: 20 },
                            1280: { slidesPerView: 5, spaceBetween: 20 },
                        }
                    });
                });
            

        (function() {
            const scroller = document.getElementById('reviewScroller');
            if (!scroller) return;
            let scrollDir = 1;
            let paused = false;

            scroller.addEventListener('mouseenter', () => paused = true);
            scroller.addEventListener('mouseleave', () => paused = false);
            scroller.addEventListener('touchstart', () => paused = true);
            scroller.addEventListener('touchend', () => { setTimeout(() => paused = false, 2000); });

            setInterval(() => {
                if (paused) return;
                scroller.scrollLeft += scrollDir * 1;
                if (scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 2) scrollDir = -1;
                if (scroller.scrollLeft <= 2) scrollDir = 1;
            }, 30);
        })();
    

    function openReviewModal() {
        const modal = document.getElementById('reviewModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        } else {
            window.location.href = '/#reviews';
        }
    }

    function closeReviewModal() {
        const modal = document.getElementById('reviewModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('reviewForm').reset();
        
        const img = document.getElementById('reviewImagePreview');
        if (img) {
            img.removeAttribute('src');
            img.hidden = true;
        }
        
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('fileName').textContent = 'Tải ảnh lên (tùy chọn)';
    }

    function setRating(val) {
        document.getElementById('ratingInput').value = val;
        const stars = document.querySelectorAll('.star-icon');
        stars.forEach((star, index) => {
            if (index < val) {
                star.classList.add('star-active-icon');
            } else {
                star.classList.remove('star-active-icon');
            }
        });
    }

    function previewImage(input) {
        const file = input.files[0];
        const preview = document.getElementById('imagePreview');
        const img = document.getElementById('reviewImagePreview');
        const fileName = document.getElementById('fileName');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                if (img) {
                    img.src = e.target.result;
                    img.hidden = false;
                }
                preview.style.display = 'block';
                fileName.textContent = file.name;
            }
            reader.readAsDataURL(file);
        } else {
            if (img) {
                img.removeAttribute('src');
                img.hidden = true;
            }
            preview.style.display = 'none';
            fileName.textContent = 'Tải ảnh lên (tùy chọn)';
        }
    }

    async function submitReview(e) {
        e.preventDefault();
        const btn = document.getElementById('submitReviewBtn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span style="width:16px; height:16px; border:2px solid #8b7500; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></span>';

        const formData = new FormData(e.target);
        formData.append('rating', document.getElementById('ratingInput').value);

        try {
            const response = await fetch('/api/reviews', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': 'mPPpN7Ke2b6U83o27RFJG2U5TnkyAmXwT5PbTkvI',
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                closeReviewModal();
                if (window.lgAlert) {
                    lgAlert('Thành công', 'Cảm ơn bạn đã đánh giá dịch vụ!', 'success');
                } else {
                    alert('Cảm ơn bạn đã đánh giá dịch vụ!');
                }
            } else {
                if (window.lgAlert) {
                    lgAlert('Lỗi', data.message || 'Có lỗi xảy ra, vui lòng thử lại.', 'error');
                } else {
                    alert(data.message || 'Có lỗi xảy ra');
                }
            }
        } catch (error) {
            closeReviewModal();
            if (window.lgAlert) {
                lgAlert('Thành công', 'Cảm ơn bạn đã gửi đánh giá cho Locket Gold!', 'success');
            } else {
                alert('Cảm ơn bạn đã gửi đánh giá cho Locket Gold!');
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }


        (function () {
            const cat = document.getElementById('scroll-cat');
            if (!cat) return;

            const img = cat.querySelector('img');
            let imgHeight = 400; // fallback

            img.addEventListener('load', function () {
                imgHeight = img.offsetHeight;
                updateCat();
            });

            function updateCat() {
                const scrollTop = window.scrollY;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollPercent = docHeight > 0 ? scrollTop / docHeight : 0;

                // At start: cat head peeks from top
                const basePos = -589;
                const maxDrop = 589;
                const dropY = basePos + (scrollPercent * maxDrop);

                cat.style.top = dropY + 'px';
            }

            window.addEventListener('scroll', updateCat, { passive: true });
            setTimeout(updateCat, 100);
        })();
    

    function toast(type, title, message = '', duration = 5000) {
        const icons = {
            success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11l3 3L22 4"/></svg>',
            error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        const container = document.getElementById('toastContainer');
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" onclick="removeToast(this.parentElement)">✕</button>
            <div class="toast-progress" style="animation-duration:${duration}ms"></div>
        `;
        container.appendChild(el);
        setTimeout(() => removeToast(el), duration);
    }

    function removeToast(el) {
        if (!el || el.classList.contains('removing')) return;
        el.classList.add('removing');
        setTimeout(() => el.remove(), 350);
    }


            (function () {
                const notifId = '13';
                const snoozed = localStorage.getItem('notif_snoozed_' + notifId);
                if (snoozed && Date.now() < parseInt(snoozed)) return;
                setTimeout(() => {
                    document.getElementById('notifModal').style.display = 'flex';
                }, 500);
            })();
            function closeNotifModal() {
                document.getElementById('notifModal').style.display = 'none';
            }
            function snoozeNotif() {
                const notifId = '13';
                localStorage.setItem('notif_snoozed_' + notifId, Date.now() + 7200000);
                closeNotifModal();
            }
        

        (function () {
            const dialog = document.getElementById('lgDialog');
            const iconEl = document.getElementById('lgDialogIcon');
            const titleEl = document.getElementById('lgDialogTitle');
            const msgEl = document.getElementById('lgDialogMsg');
            const btnsEl = document.getElementById('lgDialogBtns');

            function showDialog(opts) {
                return new Promise(resolve => {
                    const icons = {
                        warning: { svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', bg: '#fef3c7' },
                        danger: { svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', bg: '#fee2e2' },
                        info: { svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>', bg: '#dbeafe' },
                        success: { svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11l3 3L22 4"/></svg>', bg: '#dcfce7' },
                        question: { svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', bg: '#f3e8ff' }
                    };
                    const ic = icons[opts.type || 'warning'] || icons.warning;
                    iconEl.innerHTML = ic.svg;
                    iconEl.style.background = ic.bg;
                    titleEl.textContent = opts.title || 'Thông báo';
                    msgEl.textContent = opts.message || '';
                    btnsEl.innerHTML = '';

                    if (opts.showCancel !== false) {
                        const cancelBtn = document.createElement('button');
                        cancelBtn.className = 'lg-btn lg-btn-cancel';
                        cancelBtn.textContent = opts.cancelText || 'Hủy';
                        cancelBtn.onclick = () => { dialog.style.display = 'none'; resolve(false); };
                        btnsEl.appendChild(cancelBtn);
                    }

                    const okBtn = document.createElement('button');
                    okBtn.className = 'lg-btn ' + (opts.btnClass || 'lg-btn-primary');
                    okBtn.textContent = opts.okText || 'Xác nhận';
                    okBtn.onclick = () => { dialog.style.display = 'none'; resolve(true); };
                    btnsEl.appendChild(okBtn);

                    dialog.style.display = 'flex';
                });
            }

            // Override native confirm
            window._nativeConfirm = window.confirm;
            window.confirm = function (msg) { return null; };

            // Global custom confirm for forms
            window.lgConfirm = showDialog;

            // Auto-bind forms with onsubmit="return confirm(...)"
            document.addEventListener('submit', function (e) {
                const form = e.target;
                const onsubmit = form.getAttribute('onsubmit');
                if (!onsubmit || !onsubmit.includes('confirm(')) return;

                const match = onsubmit.match(/confirm\(['"](.+?)['"]\)/);
                if (!match) return;

                e.preventDefault();
                form.removeAttribute('onsubmit');

                const msg = match[1];
                const isDanger = msg.includes('xóa') || msg.includes('Xóa') || msg.includes('từ chối') || msg.includes('Từ chối');

                showDialog({
                    type: isDanger ? 'danger' : 'warning',
                    title: isDanger ? 'Xác nhận xóa' : 'Xác nhận',
                    message: msg,
                    okText: isDanger ? 'Xóa' : 'Xác nhận',
                    btnClass: isDanger ? 'lg-btn-danger' : 'lg-btn-primary',
                    cancelText: 'Hủy'
                }).then(ok => {
                    if (ok) form.submit();
                    else form.setAttribute('onsubmit', onsubmit);
                });
            }, true);

            // Override alert
            window._nativeAlert = window.alert;
            window.alert = function (msg) {
                showDialog({
                    type: 'info',
                    title: 'Thông báo',
                    message: msg,
                    showCancel: false,
                    okText: 'Đã hiểu'
                });
            };
        })();
    

        let isZaloMenuOpen = false;
        function toggleZaloMenu() {
            const menu = document.getElementById('zalo-sub-menu');
            const closeIcon = document.getElementById('zalo-close-icon');
            const pulse = document.getElementById('zalo-pulse');
            const label = document.getElementById('zalo-label');

            isZaloMenuOpen = !isZaloMenuOpen;

            if (isZaloMenuOpen) {
                menu.style.display = 'flex';
                closeIcon.style.display = 'flex';
                pulse.style.display = 'none';
                if (label) label.style.display = 'none';
            } else {
                menu.style.display = 'none';
                closeIcon.style.display = 'none';
                pulse.style.display = 'block';
                if (label) label.style.display = 'block';
            }
        }
    

        document.addEventListener('DOMContentLoaded', function () {
            const scrollToTopBtn = document.getElementById('scrollToTopBtn');
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    scrollToTopBtn.classList.remove('opacity-0', 'invisible');
                    scrollToTopBtn.classList.add('opacity-100', 'visible');
                } else {
                    scrollToTopBtn.classList.add('opacity-0', 'invisible');
                    scrollToTopBtn.classList.remove('opacity-100', 'visible');
                }
            });
            scrollToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    

        // Disable Right-Click (Context Menu)
        document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        // Disable Inspect Keys
        document.addEventListener('keydown', function (e) {
            if (e.keyCode === 123) { e.preventDefault(); return false; }
            if ((e.ctrlKey || e.metaKey) && e.keyCode === 85) { e.preventDefault(); return false; }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.keyCode === 73) { e.preventDefault(); return false; }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.keyCode === 74) { e.preventDefault(); return false; }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.keyCode === 67) { e.preventDefault(); return false; }
            if ((e.ctrlKey || e.metaKey) && e.keyCode === 83) { e.preventDefault(); return false; }
        });
    

        document.addEventListener('DOMContentLoaded', function () {
            const popup = document.getElementById('fake-purchase-popup');
            const nameEl = document.getElementById('fake-purchase-name');
            const planEl = document.getElementById('fake-purchase-plan');
            const timeEl = document.getElementById('fake-purchase-time');
            
            const names = ["Nguyễn ***", "Trần ***", "Lê ***", "Phạm ***", "Hoàng ***", "Vũ ***", "Võ ***", "Đặng ***", "Bùi ***", "Đỗ ***", "Hồ ***", "Ngô ***", "Dương ***", "Lý ***"];
            const plans = ["Gói Premium", "Gói Premium", "Gói Premium", "Gói Pro", "Gói Basic", "Gói Premium"];
            
            function getRandomItem(arr) {
                return arr[Math.floor(Math.random() * arr.length)];
            }
            
            function showFakePopup() {
                nameEl.textContent = getRandomItem(names);
                
                planEl.textContent = getRandomItem(plans);
                
                const timeValue = Math.floor(Math.random() * 59) + 1;
                const isSec = Math.random() > 0.3;
                timeEl.textContent = timeValue + (isSec ? " giây" : " phút");
                
                popup.classList.remove('translate-y-10', 'opacity-0');
                popup.classList.add('translate-y-0', 'opacity-100');
                
                setTimeout(() => {
                    popup.classList.remove('translate-y-0', 'opacity-100');
                    popup.classList.add('translate-y-10', 'opacity-0');
                }, 4000);
            }
            
            setTimeout(() => {
                showFakePopup();
                setInterval(showFakePopup, 10000);
            }, 3000);
        });


// Sync Login State & Dropdown
window.lgLogout = function() {
    if(confirm('Bạn có muốn đăng xuất không?')) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('user');
    const mobileAuthSlot = document.getElementById('mobile-auth-slot');

    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const loginLinks = document.querySelectorAll('a[href="/login"], a[href="/login/"], a[href="login.html"]');
            
            loginLinks.forEach(link => {
                const isMobile = link.closest('.lg\\:hidden') !== null || link.closest('#mobile-auth-slot') !== null;
                if (isMobile) {
                    link.outerHTML = `
                        <div class="flex flex-col gap-2">
                            <a href="/profile/" class="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl text-slate-800 dark:text-zinc-200 bg-amber-400/15 dark:bg-zinc-800 border border-amber-400/30">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=f59e0b&color=fff&rounded=true" class="w-6 h-6 rounded-full object-cover shrink-0" />
                                <span class="truncate">Hi, <strong>${user.username}</strong></span>
                            </a>
                            <button onclick="window.lgLogout()" class="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-all cursor-pointer">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                Đăng xuất
                            </button>
                        </div>
                    `;
                } else {
                    const dropdownHtml = `
<button @click="open = !open" class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-all text-sm font-semibold text-gray-800 dark:text-gray-200">
    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&color=fff&rounded=true" class="w-7 h-7 rounded-full object-cover shadow-sm bg-white" />
    Hi, ${user.username}
    <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
</button>

<div x-show="open" @click.away="open = false" style="display: none;" class="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 py-2 z-50 flex flex-col">
    <a href="/profile/" class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
        <svg fill="none" class="w-4 h-4 opacity-70" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        Hồ sơ cá nhân
    </a>
    <a href="/activate/" class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
        <svg fill="none" class="w-4 h-4 opacity-70" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
        Đăng ký gói VIP
    </a>
    <a href="/profile/" class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
        <svg fill="none" class="w-4 h-4 opacity-70" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
        Lịch sử đơn hàng
    </a>
    
    <div class="h-px bg-gray-100 dark:bg-zinc-800 my-1"></div>
    
    <button onclick="window.lgLogout()" class="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
        <svg fill="none" class="w-4 h-4 opacity-70" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
        Đăng xuất
    </button>
</div>
`;              
                    const parent = link.parentElement;
                    if (parent && !parent.hasAttribute('x-data')) {
                        parent.setAttribute('x-data', '{ open: false }');
                        parent.classList.add('relative');
                    }
                    link.outerHTML = dropdownHtml;
                }
            });

            window.lgLogout = function() {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                alert('Đã đăng xuất tài khoản thành công!');
                window.location.reload();
            };
        } catch(e) {}
    }
});

// Scroll Reveal Observer
document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                entry.target.classList.add('animate-fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
        observer.observe(el);
    });
});

// Bottom Nav Scroll Spy
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.mobile-bottom-nav .nav-item');
    if (!navItems.length) return;

    const currentPath = window.location.pathname;
    if (currentPath.endsWith('index.html') || currentPath === '/' || currentPath.endsWith('SHOPLOCKETT/')) {
        window.addEventListener('scroll', () => {
            const pricingSection = document.getElementById('pricing');
            if (!pricingSection) return;

            let current = 'index.html';
            const pricingTop = pricingSection.offsetTop - window.innerHeight / 2;
            
            if (window.scrollY >= pricingTop) {
                current = '#pricing';
            }

            navItems.forEach(item => {
                const href = item.getAttribute('href');
                if (href === 'index.html' || href === '#pricing') {
                    if (href === current) item.classList.add('active');
                    else item.classList.remove('active');
                }
            });
        });
    }
});

// Smart Locket Username Info Lookup Helper
window.lookupLocketUsername = async function(username) {
    if (!username) return null;
    const cleanName = username.trim().replace('@', '');
    try {
        const WORKER_URL = 'https://shopbanhanglkduongbinh.caovannamutt.workers.dev';
        const res = await fetch(WORKER_URL + '/api/locket-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: cleanName })
        });
        return await res.json();
    } catch(e) {
        console.error('Lookup Locket Username error:', e);
        return null;
    }
};

