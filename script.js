/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO — Cinematic Interactions Engine v3
   Interactive particle constellation + sticky cards + magnetic cursor
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    /* ═══════════════════════════════════════════════════════════
       0. LENIS SMOOTH SCROLLING & GSAP SETUP
       ═══════════════════════════════════════════════════════════ */
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
    });

    // Update ScrollTrigger on Lenis scroll
    lenis.on('scroll', ScrollTrigger.update);

    // Add Lenis's requestAnimationFrame to GSAP's ticker
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });

    // Turn off GSAP's default lag smoothing to prevent conflicts
    gsap.ticker.lagSmoothing(0);

    /* ═══════════════════════════════════════════════════════════
       1. INTERACTIVE PARTICLE CONSTELLATION — Three.js Hero Canvas
       ═══════════════════════════════════════════════════════════ */
    const heroCanvas = document.getElementById('hero-canvas');
    if (heroCanvas && typeof THREE !== 'undefined') {
        const scene = new THREE.Scene();
        
        // Use an orthographic camera for a more 2D/graphic feel, or Perspective for depth.
        // We will use Perspective to give the "digital laboratory" depth.
        const camera = new THREE.PerspectiveCamera(75, heroCanvas.offsetWidth / heroCanvas.offsetHeight, 0.1, 1000);
        camera.position.z = 40;

        const renderer = new THREE.WebGLRenderer({ canvas: heroCanvas, alpha: true, antialias: true });
        renderer.setSize(heroCanvas.offsetWidth, heroCanvas.offsetHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Create Particles
        const particleCount = window.innerWidth < 768 ? 400 : 1200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount * 3; i += 3) {
            // Distribute particles in a wide field
            positions[i] = (Math.random() - 0.5) * 100;     // x
            positions[i + 1] = (Math.random() - 0.5) * 100; // y
            positions[i + 2] = (Math.random() - 0.5) * 50;  // z
            
            velocities.push({
                x: (Math.random() - 0.5) * 0.05,
                y: (Math.random() - 0.5) * 0.05,
                z: (Math.random() - 0.5) * 0.05
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Create a custom shader material for crisp, glowing points
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: window.innerWidth < 768 ? 0.3 : 0.2,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        // Lines connecting close particles
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.05,
            blending: THREE.AdditiveBlending
        });
        
        // We'll update the line geometry in the animation loop
        const lineGeometry = new THREE.BufferGeometry();
        const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
        scene.add(linesMesh);

        // Mouse interaction setup
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;
        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;

        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - windowHalfX);
            mouseY = (event.clientY - windowHalfY);
        });

        // Resize handler
        window.addEventListener('resize', () => {
            camera.aspect = heroCanvas.offsetWidth / heroCanvas.offsetHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(heroCanvas.offsetWidth, heroCanvas.offsetHeight);
        });

        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const time = clock.getElapsedTime();

            targetX = mouseX * 0.05;
            targetY = mouseY * 0.05;

            // Soft camera follow mouse
            camera.position.x += (targetX - camera.position.x) * 0.02;
            camera.position.y += (-targetY - camera.position.y) * 0.02;
            camera.lookAt(scene.position);

            // Animate particles
            const positions = particles.geometry.attributes.position.array;
            let linePositions = [];

            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                
                // Float around
                positions[i3] += velocities[i].x;
                positions[i3 + 1] += velocities[i].y;
                positions[i3 + 2] += velocities[i].z;

                // Simple boundary wrap
                if(positions[i3] > 50) positions[i3] = -50;
                if(positions[i3] < -50) positions[i3] = 50;
                if(positions[i3+1] > 50) positions[i3+1] = -50;
                if(positions[i3+1] < -50) positions[i3+1] = 50;
                if(positions[i3+2] > 25) positions[i3+2] = -25;
                if(positions[i3+2] < -25) positions[i3+2] = 25;

                // Add mouse repulsion based on 2D screen projection approx
                // (Complex to accurately map 3D -> 2D repel, so we fake a global push)
                // A subtle wave effect based on time
                positions[i3+1] += Math.sin(time + positions[i3]) * 0.005;

                // Find connections (expensive, so we limit how many we check)
                if (i % 3 === 0) { // optimization
                    for (let j = i + 1; j < particleCount; j+=3) {
                        const j3 = j * 3;
                        const dx = positions[i3] - positions[j3];
                        const dy = positions[i3+1] - positions[j3+1];
                        const dz = positions[i3+2] - positions[j3+2];
                        const distSq = dx*dx + dy*dy + dz*dz;

                        if (distSq < 15) { // Connection threshold
                            linePositions.push(
                                positions[i3], positions[i3+1], positions[i3+2],
                                positions[j3], positions[j3+1], positions[j3+2]
                            );
                        }
                    }
                }
            }
            
            particles.geometry.attributes.position.needsUpdate = true;
            
            // Update lines
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
            // Adjust line opacity based on connection count to prevent blowout
            lineMaterial.opacity = Math.max(0.01, 0.1 - (linePositions.length / 50000));

            // Whole system slow rotation
            particles.rotation.y = time * 0.05;
            linesMesh.rotation.y = time * 0.05;

            renderer.render(scene, camera);
        }

        animate();
    }

    /* ═══════════════════════════════════════════════════════════
       2. CUSTOM CURSOR & MAGNETIC EFFECTS (Powered by GSAP)
       ═══════════════════════════════════════════════════════════ */
    const cursor = document.getElementById('cursor');
    const follower = document.getElementById('cursor-follower');

    if (cursor && follower && window.innerWidth > 768) {
        // Quick setters for performance
        const setCursorX = gsap.quickSetter(cursor, "x", "px");
        const setCursorY = gsap.quickSetter(cursor, "y", "px");
        const setFollowerX = gsap.quickSetter(follower, "x", "px");
        const setFollowerY = gsap.quickSetter(follower, "y", "px");
        
        // Track mouse position
        let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        let followerPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            
            // Instant move for the tiny dot
            setCursorX(mouse.x);
            setCursorY(mouse.y);
        });

        // Smooth follow logic using GSAP ticker
        gsap.ticker.add(() => {
            // Lerp the follower position towards the mouse
            followerPos.x += (mouse.x - followerPos.x) * 0.15;
            followerPos.y += (mouse.y - followerPos.y) * 0.15;
            
            setFollowerX(followerPos.x);
            setFollowerY(followerPos.y);
        });

        // Hover states
        const hoverTargets = document.querySelectorAll('a, button, .magnetic, .stack-card, .skill-tag, .research-item');
        hoverTargets.forEach(el => {
            el.addEventListener('mouseenter', () => {
                follower.classList.add('hovering');
                gsap.to(follower, {
                    width: 64,
                    height: 64,
                    borderColor: 'var(--accent)',
                    backgroundColor: 'var(--accent-dim)',
                    duration: 0.3,
                    ease: 'power2.out'
                });
            });
            el.addEventListener('mouseleave', () => {
                follower.classList.remove('hovering');
                gsap.to(follower, {
                    width: 44,
                    height: 44,
                    borderColor: 'var(--border-hover)',
                    backgroundColor: 'transparent',
                    duration: 0.3,
                    ease: 'power2.out'
                });
            });
        });

        // Magnetic Buttons
        document.querySelectorAll('.magnetic').forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = (e.clientX - rect.left - rect.width / 2) * 0.3;
                const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
                
                gsap.to(el, { x: x, y: y, duration: 0.4, ease: "power2.out" });
                
                // Optional inner element magnet (e.g., text inside)
                const inner = el.querySelector('span') || el.querySelector('i');
                if(inner) {
                    gsap.to(inner, { x: x * 0.5, y: y * 0.5, duration: 0.4, ease: "power2.out" });
                }
            });

            el.addEventListener('mouseleave', () => {
                gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
                const inner = el.querySelector('span') || el.querySelector('i');
                if(inner) {
                    gsap.to(inner, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
                }
            });
        });
    }

    /* ═══════════════════════════════════════════════════════════
       5. INTERACTIVE TIMELINE (About Section)
       ═══════════════════════════════════════════════════════════ */
    const timelineNodes = document.querySelectorAll('.timeline-node');
    
    if (timelineNodes.length > 0) {
        // Initialize GSAP heights
        timelineNodes.forEach((node, index) => {
            const details = node.querySelector('.node-details');
            if (index === 0) {
                node.classList.add('active');
                gsap.set(details, { height: 'auto', opacity: 1, marginTop: 16 });
            } else {
                gsap.set(details, { height: 0, opacity: 0, marginTop: 0, overflow: 'hidden' });
            }

            node.addEventListener('click', () => {
                if (node.classList.contains('active')) return;

                // Close others
                timelineNodes.forEach(otherNode => {
                    if (otherNode.classList.contains('active')) {
                        otherNode.classList.remove('active');
                        const otherDetails = otherNode.querySelector('.node-details');
                        gsap.to(otherDetails, { height: 0, opacity: 0, marginTop: 0, duration: 0.4, ease: 'power2.inOut' });
                    }
                });

                // Open clicked
                node.classList.add('active');
                gsap.to(details, { height: 'auto', opacity: 1, marginTop: 16, duration: 0.5, ease: 'power3.out' });
            });
            
            // Hover effect on the point
            const point = node.querySelector('.node-point');
            node.addEventListener('mouseenter', () => gsap.to(point, { scale: 1.5, duration: 0.3, ease: 'back.out(2)' }));
            node.addEventListener('mouseleave', () => gsap.to(point, { scale: 1, duration: 0.3, ease: 'power2.out' }));
        });
    }

    /* ═══════════════════════════════════════════════════════════
       3. GSAP SCROLL REVEALS
       ═══════════════════════════════════════════════════════════ */
    // General section reveals
    const revealElements = gsap.utils.toArray('.reveal');
    revealElements.forEach((el) => {
        gsap.fromTo(el, 
            { y: 50, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                duration: 1.2,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                }
            }
        );
    });

    /* ═══════════════════════════════════════════════════════════
       4. COUNTER ANIMATION (hero stats)
       ═══════════════════════════════════════════════════════════ */
    const counters = document.querySelectorAll('[data-count]');
    
    counters.forEach(c => {
        const target = parseInt(c.getAttribute('data-count'));
        const obj = { val: 0 };
        
        ScrollTrigger.create({
            trigger: c,
            start: "top 90%",
            once: true,
            onEnter: () => {
                gsap.to(obj, {
                    val: target,
                    duration: 2.5,
                    ease: "power3.out",
                    onUpdate: () => {
                        c.textContent = Math.round(obj.val) + (obj.val === target ? '+' : '');
                    }
                });
            }
        });
    });

    /* ═══════════════════════════════════════════════════════════
       6. FLOATING PROJECT CARDS (Parallax via GSAP)
       ═══════════════════════════════════════════════════════════ */
    const projectCards = document.querySelectorAll('.project-card');

    if (projectCards.length > 0) {
        projectCards.forEach((card, i) => {
            gsap.to(card, {
                y: -100, // Move up slightly as user scrolls past
                ease: "none",
                scrollTrigger: {
                    trigger: card,
                    start: "top bottom", 
                    end: "bottom top",
                    scrub: 1.5,
                }
            });
        });
    }

    /* GSAP Stacking removed for simplicity per user request */


    /* ═══════════════════════════════════════════════════════════
       7. NAVBAR
       ═══════════════════════════════════════════════════════════ */
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 60);
        }
    }, { passive: true });

    /* ═══════════════════════════════════════════════════════════
       8. MOBILE NAV
       ═══════════════════════════════════════════════════════════ */
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = navToggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });

        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                const icon = navToggle.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            });
        });
    }



    /* ═══════════════════════════════════════════════════════════
       10. SMOOTH SCROLL
       ═══════════════════════════════════════════════════════════ */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const navH = navbar ? navbar.offsetHeight : 0;
                window.scrollTo({
                    top: target.getBoundingClientRect().top + window.scrollY - navH - 24,
                    behavior: 'smooth'
                });
            }
        });
    });
    /* ═══════════════════════════════════════════════════════════
       11. CINEMATIC INTRO TRANSITION
       ═══════════════════════════════════════════════════════════ */
    const introOverlay = document.getElementById('intro-overlay');
    const introVideo = document.getElementById('intro-video');

    if (introOverlay && introVideo) {
        // Force play
        introVideo.play().catch(e => {
            console.log("Intro autoplay blocked, Proceeding to reveal.");
            finishIntro();
        });

        const finishIntro = () => {
            gsap.to(introOverlay, {
                filter: "blur(50px)",
                opacity: 0,
                duration: 1.5,
                ease: "power2.inOut",
                onComplete: () => {
                    introOverlay.style.display = 'none';
                    document.body.classList.remove('is-loading');
                    // Trigger initial reveals if any
                    ScrollTrigger.refresh();
                }
            });
        };

        // Transition after 5s or when video ends
        const introTimeout = setTimeout(finishIntro, 5500); // Slight buffer for 5s video

        introVideo.onended = () => {
            clearTimeout(introTimeout);
            finishIntro();
        };
    } else {
        document.body.classList.remove('is-loading');
    }

    /* ═══════════════════════════════════════════════════════════
       12. GLOBAL DETAIL OVERLAY
       ═══════════════════════════════════════════════════════════ */
    const detailOverlay = document.getElementById('detail-overlay');
    const detailContent = document.getElementById('detail-content');
    const detailClose = document.querySelector('.detail-overlay__close');
    const interactiveItems = document.querySelectorAll('.stack-card, .research-item, .blog-item');

    function openOverlay(data) {
        if (!detailOverlay || !detailContent) return;

        // Populate content based on type
        let html = '';
        if (data.type === 'project') {
            html = `
                <div class="detail-project">
                    <div class="detail-header">
                        <span class="detail-category">${data.meta}</span>
                        <h2 class="detail-title">${data.title}</h2>
                    </div>
                    <div class="detail-body">
                        <div class="detail-info">
                            <p class="detail-full-desc">${data.full}</p>
                            <div class="detail-tags">
                                ${data.tags ? data.tags.split(',').map(tag => `<span class="detail-tag">${tag.trim()}</span>`).join('') : ''}
                            </div>
                        </div>
                        <div class="detail-actions">
                            <a href="${data.link || '#'}" class="btn btn--white" target="_blank">View Live Project <i class="fas fa-external-link-alt"></i></a>
                        </div>
                    </div>
                </div>
            `;
        } else if (data.type === 'research') {
            html = `
                <div class="detail-research">
                    <div class="detail-header">
                        <span class="detail-category">${data.meta}</span>
                        <h2 class="detail-title">${data.title}</h2>
                    </div>
                    <div class="detail-body">
                        <div class="detail-section">
                            <h4 class="detail-section-title">Abstract</h4>
                            <p class="detail-abstract">${data.abstract}</p>
                        </div>
                        <div class="detail-section">
                            <h4 class="detail-section-title">Authors</h4>
                            <p class="detail-meta-text">${data.authors}</p>
                        </div>
                        <div class="detail-section">
                            <h4 class="detail-section-title">Keywords</h4>
                            <p class="detail-meta-text">${data.keywords}</p>
                        </div>
                        <div class="detail-grid">
                            <div class="detail-section">
                                <h4 class="detail-section-title">Conference / Journal</h4>
                                <p class="detail-meta-text">${data.conf}</p>
                            </div>
                        </div>
                        <div class="detail-actions">
                            <a href="${data.link || '#'}" class="btn btn--white" target="_blank">Access Publication <i class="fas fa-file-alt"></i></a>
                        </div>
                    </div>
                </div>
            `;
        } else if (data.type === 'blog') {
            html = `
                <div class="detail-blog">
                    <div class="detail-header">
                        <span class="detail-category">${data.date}</span>
                        <h2 class="detail-title">${data.title}</h2>
                    </div>
                    <div class="detail-body">
                        <div class="detail-blog-content">
                            ${data.content}
                        </div>
                        <div class="detail-actions">
                            <a href="${data.blogger || '#'}" class="btn btn--white" target="_blank">Follow on Blogger <i class="fas fa-link"></i></a>
                        </div>
                    </div>
                </div>
            `;
        }

        detailContent.innerHTML = html;
        detailOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Animate BG in
        gsap.to(detailOverlay.querySelector('.detail-overlay__bg'), {
            opacity: 1,
            duration: 0.5,
            ease: "power2.out"
        });

        // Animate container in
        gsap.fromTo(detailOverlay.querySelector('.detail-overlay__container'), 
            { y: 50, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "expo.out", delay: 0.1 }
        );
    }

    function closeOverlay() {
        // Animate components out
        gsap.to(detailOverlay.querySelector('.detail-overlay__container'), {
            y: 30,
            opacity: 0,
            duration: 0.4,
            ease: "power2.in"
        });

        gsap.to(detailOverlay.querySelector('.detail-overlay__bg'), {
            opacity: 0,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                detailOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    interactiveItems.forEach(item => {
        item.addEventListener('click', () => {
            const data = { ...item.dataset };
            if (Object.keys(data).length > 0) openOverlay(data);
        });
    });

    if (detailClose) detailClose.addEventListener('click', closeOverlay);
    if (detailOverlay) {
        detailOverlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('detail-overlay') || e.target.classList.contains('detail-overlay__bg')) {
                closeOverlay();
            }
        });
    }

    // Escape key to close
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && detailOverlay.classList.contains('active')) {
            closeOverlay();
        }
    });
    const scrollTopBtn = document.getElementById('scroll-top');

    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            scrollTopBtn.style.display = window.scrollY > 800 ? 'flex' : 'none';
        }, { passive: true });

        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

});
