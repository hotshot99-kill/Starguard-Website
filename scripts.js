        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Global variables provided by the Canvas environment
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // UI elements for messages
        const messageBox = document.getElementById('message-box');

        // Function to display messages
        function showMessage(message, type = 'info') {
            messageBox.textContent = message;
            messageBox.className = `message-box ${type}`; // Add type for styling (e.g., 'success', 'error')
            messageBox.classList.remove('hidden');
            setTimeout(() => {
                messageBox.classList.add('hidden');
            }, 5000); // Hide after 5 seconds
        }

        // Authentication state observer (simplified, no direct display on page)
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in.
                const userId = user.uid;
                console.log(`User logged in with ID: ${userId}, Email: ${user.email || 'Anonymous'}`);
            } else {
                // User is signed out or anonymous.
                console.log('User is not logged in or is anonymous.');
            }
        });

        // Initial authentication attempt (anonymous or with custom token)
        async function authenticateUser() {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                    console.log('Signed in with custom token.');
                } else {
                    await signInAnonymously(auth);
                    console.log('Signed in anonymously.');
                }
            } catch (error) {
                console.error('Authentication error:', error);
            }
        }
        authenticateUser();

        // --- Modal and Form Toggling Logic ---
        const loginSignupButton = document.getElementById('login-signup-button');
        const authModal = document.getElementById('auth-modal');
        const closeModalButton = document.getElementById('close-modal-button');
        const modalTitle = document.getElementById('modal-title');

        const showLoginButton = document.getElementById('show-login');
        const showSignupButton = document.getElementById('show-signup');
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');

        const signupLinkFromLogin = document.getElementById('signup-link-from-login');
        const loginLinkFromSignup = document.getElementById('login-link-from-signup');

        function showForm(formToShow) {
            loginForm.classList.add('hidden');
            signupForm.classList.add('hidden');
            showLoginButton.classList.remove('text-blue-400', 'border-blue-400');
            showLoginButton.classList.add('border-transparent');
            showSignupButton.classList.remove('text-blue-400', 'border-blue-400');
            showSignupButton.classList.add('border-transparent');

            if (formToShow === 'login') {
                loginForm.classList.remove('hidden');
                showLoginButton.classList.add('text-blue-400', 'border-blue-400');
                modalTitle.textContent = 'Welcome Back!';
            } else if (formToShow === 'signup') {
                signupForm.classList.remove('hidden');
                showSignupButton.classList.add('text-blue-400', 'border-blue-400');
                modalTitle.textContent = 'Create Your Account';
            }
        }

        loginSignupButton.addEventListener('click', () => {
            authModal.classList.remove('hidden');
            showForm('login'); // Default to showing login form when modal opens
        });

        closeModalButton.addEventListener('click', () => {
            authModal.classList.add('hidden');
        });

        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.add('hidden');
            }
        });

        showLoginButton.addEventListener('click', () => showForm('login'));
        showSignupButton.addEventListener('click', () => showForm('signup'));
        signupLinkFromLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showForm('signup');
        });
        loginLinkFromSignup.addEventListener('click', (e) => {
            e.preventDefault();
            showForm('login');
        });

        // --- Firebase Login and Sign Up Logic ---
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[name="email"]').value;
            const password = loginForm.querySelector('input[name="password"]').value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
                showMessage('Logged in successfully!', 'success');
                authModal.classList.add('hidden');
                // You can add a redirect here if needed: window.location.href = 'welcome.html';
            } catch (error) {
                console.error('Login error:', error);
                showMessage(`Login failed: ${error.message}`, 'error');
            }
        });

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = signupForm.querySelector('input[name="username"]').value.trim();
            const email = signupForm.querySelector('input[name="email"]').value.trim();
            const password = signupForm.querySelector('input[name="password"]').value;
            const confirmPassword = signupForm.querySelector('input[name="confirm-password"]').value;

            // Basic client-side validation
            if (!username || !email || !password || !confirmPassword) {
                showMessage('Please fill in all fields.', 'error');
                return;
            }
            if (password.length < 6) {
                showMessage('Password must be at least 6 characters long.', 'error');
                return;
            }
            if (password !== confirmPassword) {
                showMessage('Passwords do not match.', 'error');
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showMessage('Please enter a valid email address.', 'error');
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const userId = user.uid;

                // Store user profile data in Firestore
                const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profiles`, userId);
                await setDoc(userProfileRef, {
                    username: username,
                    email: email,
                    createdAt: new Date()
                });
                showMessage('Sign Up successful!', 'success');
                authModal.classList.add('hidden');
                // You can add a redirect here if needed: window.location.href = 'welcome.html';
            } catch (error) {
                console.error('Sign Up error:', error);
                showMessage(`Sign Up failed: ${error.message}`, 'error');
            }
        });

        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetElement = document.querySelector(this.getAttribute('href'));
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
                // Close mobile menu after clicking a link
                const mainMenu = document.getElementById('main-menu');
                if (mainMenu.classList.contains('flex') && window.innerWidth < 768) {
                    mainMenu.classList.remove('flex');
                }
            });
        });

        // Mobile menu toggle functionality
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mainMenu = document.getElementById('main-menu');

        mobileMenuButton.addEventListener('click', () => {
            mainMenu.classList.toggle('flex');
        });
