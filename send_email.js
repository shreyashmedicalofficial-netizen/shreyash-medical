const nodemailer = require('nodemailer');

async function sendTestEmail() {
    // strict SMTP credentials provided by user
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'shreyashmedicalofficial@gmail.com',
            pass: 'okap wvhf rtql ibaz'
        }
    });

    const mailOptions = {
        from: '"Shreyash Medical" <shreyashmedicalofficial@gmail.com>',
        to: 'akashvipatil9555@gmail.com', // Default recipient from previous context, or change as needed
        subject: 'Test Email from Shreyash Medical Debugger',
        text: 'This is a test email sent using Node.js and Nodemailer to verify your Gmail App Credentials work.',
        html: '<h3>Success!</h3><p>This email proves your Gmail App Password is correct and capable of sending mail via Node.js.</p>'
    };

    try {
        console.log('Attempting to send email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent: ' + info.response);
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}

sendTestEmail();
