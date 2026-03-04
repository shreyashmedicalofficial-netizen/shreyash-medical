const http = require('http');
const nodemailer = require('nodemailer');

const PORT = 3000;

// Configure Nodemailer with User Credentials
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'shreyashmedicalofficial@gmail.com',
        pass: 'okap wvhf rtql ibaz'
    }
});

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle Preflight Request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/send-email') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const recipientEmail = data.email;

                if (!recipientEmail) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Email is required' }));
                    return;
                }

                const mailOptions = {
                    from: '"Shreyash Medical" <shreyashmedicalofficial@gmail.com>',
                    to: recipientEmail,
                    subject: 'Test Email from Web Debugger',
                    text: 'This email confirms that your local server is working correctly and sending emails via Node.js!',
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                            <h2 style="color: #2c3e50;">Test Successful!</h2>
                            <p>This email was sent from your local Node.js server.</p>
                            <p><strong>Recipient:</strong> ${recipientEmail}</p>
                            <hr>
                            <p style="font-size: 12px; color: #7f8c8d;">Shreyash Pharmacy Debugger</p>
                        </div>
                    `
                };

                console.log(`Sending email to ${recipientEmail}...`);
                await transporter.sendMail(mailOptions);
                console.log('✅ Email sent successfully');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Email sent successfully!' }));

            } catch (error) {
                console.error('❌ Error sending email:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Failed to send email: ' + error.message }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`\n🚀 Local Email Server running at http://localhost:${PORT}`);
    console.log(`   Endpoint: POST /send-email`);
    console.log(`\nKeep this terminal open while testing on the website.\n`);
});
