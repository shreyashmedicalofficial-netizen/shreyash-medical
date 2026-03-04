
/**
 * Auth Utilities for Shreyash Pharmacy
 */

import { auth, sendPasswordResetEmail, sendEmailVerification } from './firebase-config.js';

// Map Firebase Error Codes to User-Friendly Messages
export function getAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return "No account found for this email, or incorrect password.";
        case 'auth/email-already-in-use':
            return "This email is already registered. Please sign in instead.";
        case 'auth/weak-password':
            return "Password should be at least 6 characters.";
        case 'auth/invalid-email':
            return "Please enter a valid email address.";
        case 'auth/too-many-requests':
            return "Too many failed attempts. Please try again later.";
        case 'auth/network-request-failed':
            return "Network error. Please check your connection.";
        default:
            return "An error occurred (" + errorCode + "). Please try again.";
    }
}

// Validate Email Format
export function isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
}

// Validate Password
export function isValidPassword(password) {
    return password && password.length >= 6;
}

// Send Password Reset Email
export async function handlePasswordReset(email) {
    if (!isValidEmail(email)) {
        throw new Error("Please enter a valid email address.");
    }
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: "Password reset link sent to " + email + ". Please check your inbox." };
    } catch (error) {
        throw new Error(getAuthErrorMessage(error.code));
    }
}

// Send Email Verification
export async function sendUserVerificationEmail(user) {
    try {
        await sendEmailVerification(user);
        return { success: true, message: "Verification email sent." };
    } catch (error) {
        console.warn("Verification email error:", error);
        return { success: false, message: error.message };
    }
}

// Send Custom Welcome Email via EmailJS (Client-Side)
export async function sendWelcomeEmail(email, name) {
    try {
        // Load config dynamically to ensure we get the latest values
        const configModule = await import('./emailjs-config.js');
        const config = configModule.default;

        if (config.serviceId === "YOUR_SERVICE_ID" || config.publicKey === "YOUR_PUBLIC_KEY") {
            console.warn("EmailJS not configured. Please update assets/js/emailjs-config.js");
            return { success: false, message: "EmailJS not configured." };
        }

        // Initialize if not already initialized (though register.html usually does this)
        if (window.emailjs) {
            emailjs.init(config.publicKey);
        }

        const templateParams = {
            to_email: email,
            to_name: name,
            message: "Welcome to Shreyash Pharmacy! We are excited to have you on board."
        };

        await emailjs.send(config.serviceId, config.templateId, templateParams);
        return { success: true, message: "Welcome email sent successfully." };
    } catch (error) {
        console.warn("Failed to send welcome email (EmailJS):", error);
        // Don't block registration if welcome email fails
        return { success: false, message: "Could not send welcome email." };
    }
}
