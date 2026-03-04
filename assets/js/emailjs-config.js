/**
 * EmailJS Configuration
 * 
 * Instructions:
 * 1. Go to https://dashboard.emailjs.com/
 * 2. Get your Public Key from 'Account' > 'API Keys'
 * 3. Create a Service (e.g., Gmail) and get the Service ID
 * 4. Create a Template and get the Template ID
 * 5. Replace the placeholders below.
 */

const emailJsConfig = {
    publicKey: "YOUR_PUBLIC_KEY",      // e.g., "user_123456..."
    serviceId: "YOUR_SERVICE_ID",      // e.g., "service_gmail"
    templateId: "YOUR_TEMPLATE_ID",    // e.g., "template_welcome"

    // Optional: Template for Password Reset (if you make a custom one, though typically Firebase handles this)
    // For now, we only use this for Welcome Emails or Custom Notifications
};

export default emailJsConfig;
