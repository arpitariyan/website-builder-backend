// src/routes/ai.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// AI website generation endpoint
router.post('/generate-website', authenticateToken, async (req, res) => {
  try {
    const { prompt, options } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    // Basic HTML generation based on prompt
    const generatedHTML = generateBasicHTML(prompt, options);
    const generatedCSS = generateBasicCSS(options);

    res.json({
      success: true,
      generatedCode: {
        html: generatedHTML,
        css: generatedCSS,
        js: '// Generated JavaScript code will go here'
      },
      message: 'Website generated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate website',
      error: error.message
    });
  }
});

// AI component suggestion endpoint
router.post('/suggest-components', authenticateToken, async (req, res) => {
  try {
    const { content, context } = req.body;

    // Basic component suggestions
    const suggestions = [
      {
        type: 'header',
        name: 'Modern Header',
        description: 'A responsive header with navigation',
        preview: '/api/templates/components/header/preview.png'
      },
      {
        type: 'hero',
        name: 'Hero Section',
        description: 'Eye-catching hero section with call-to-action',
        preview: '/api/templates/components/hero/preview.png'
      },
      {
        type: 'features',
        name: 'Feature Grid',
        description: 'Grid layout showcasing key features',
        preview: '/api/templates/components/features/preview.png'
      }
    ];

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get component suggestions',
      error: error.message
    });
  }
});

// Helper functions
function generateBasicHTML(prompt, options = {}) {
  const title = options.title || extractTitleFromPrompt(prompt);
  const theme = options.theme || 'modern';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="header">
        <div class="container">
            <nav class="navbar">
                <div class="logo">
                    <h2>${title}</h2>
                </div>
                <ul class="nav-links">
                    <li><a href="#home">Home</a></li>
                    <li><a href="#about">About</a></li>
                    <li><a href="#services">Services</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
            </nav>
        </div>
    </header>

    <main>
        <section id="home" class="hero">
            <div class="container">
                <div class="hero-content">
                    <h1>Welcome to ${title}</h1>
                    <p>Generated based on your requirements: ${prompt}</p>
                    <button class="cta-button">Get Started</button>
                </div>
            </div>
        </section>

        <section id="about" class="about">
            <div class="container">
                <h2>About Us</h2>
                <p>This section was generated based on your prompt. Customize it to match your needs.</p>
            </div>
        </section>

        <section id="services" class="services">
            <div class="container">
                <h2>Our Services</h2>
                <div class="services-grid">
                    <div class="service-card">
                        <h3>Service 1</h3>
                        <p>Description of your first service.</p>
                    </div>
                    <div class="service-card">
                        <h3>Service 2</h3>
                        <p>Description of your second service.</p>
                    </div>
                    <div class="service-card">
                        <h3>Service 3</h3>
                        <p>Description of your third service.</p>
                    </div>
                </div>
            </div>
        </section>

        <section id="contact" class="contact">
            <div class="container">
                <h2>Contact Us</h2>
                <form class="contact-form">
                    <input type="text" placeholder="Your Name" required>
                    <input type="email" placeholder="Your Email" required>
                    <textarea placeholder="Your Message" required></textarea>
                    <button type="submit">Send Message</button>
                </form>
            </div>
        </section>
    </main>

    <footer class="footer">
        <div class="container">
            <p>&copy; 2024 ${title}. All rights reserved.</p>
        </div>
    </footer>

    <script src="script.js"></script>
</body>
</html>`;
}

function generateBasicCSS(options = {}) {
  const primaryColor = options.primaryColor || '#007bff';
  const secondaryColor = options.secondaryColor || '#6c757d';
  
  return `/* Global Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    line-height: 1.6;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
.header {
    background: #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    position: fixed;
    width: 100%;
    top: 0;
    z-index: 1000;
}

.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
}

.logo h2 {
    color: ${primaryColor};
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-links a {
    text-decoration: none;
    color: #333;
    font-weight: 500;
    transition: color 0.3s;
}

.nav-links a:hover {
    color: ${primaryColor};
}

/* Hero Section */
.hero {
    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
    color: white;
    padding: 120px 0 80px;
    text-align: center;
}

.hero-content h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.hero-content p {
    font-size: 1.2rem;
    margin-bottom: 2rem;
    opacity: 0.9;
}

.cta-button {
    background: white;
    color: ${primaryColor};
    padding: 12px 30px;
    border: none;
    border-radius: 5px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.3s;
}

.cta-button:hover {
    transform: translateY(-2px);
}

/* Sections */
section {
    padding: 80px 0;
}

section h2 {
    text-align: center;
    margin-bottom: 3rem;
    font-size: 2.5rem;
    color: #333;
}

/* Services */
.services {
    background: #f8f9fa;
}

.services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.service-card {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    text-align: center;
    transition: transform 0.3s;
}

.service-card:hover {
    transform: translateY(-5px);
}

.service-card h3 {
    color: ${primaryColor};
    margin-bottom: 1rem;
}

/* Contact Form */
.contact-form {
    max-width: 600px;
    margin: 0 auto;
}

.contact-form input,
.contact-form textarea {
    width: 100%;
    padding: 12px;
    margin-bottom: 1rem;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-size: 1rem;
}

.contact-form textarea {
    height: 120px;
    resize: vertical;
}

.contact-form button {
    background: ${primaryColor};
    color: white;
    padding: 12px 30px;
    border: none;
    border-radius: 5px;
    font-size: 1.1rem;
    cursor: pointer;
    width: 100%;
    transition: background 0.3s;
}

.contact-form button:hover {
    background: ${secondaryColor};
}

/* Footer */
.footer {
    background: #333;
    color: white;
    text-align: center;
    padding: 2rem 0;
}

/* Responsive Design */
@media (max-width: 768px) {
    .navbar {
        flex-direction: column;
        gap: 1rem;
    }
    
    .nav-links {
        gap: 1rem;
    }
    
    .hero-content h1 {
        font-size: 2rem;
    }
    
    .services-grid {
        grid-template-columns: 1fr;
    }
}`;
}

function extractTitleFromPrompt(prompt) {
  // Simple title extraction logic
  const words = prompt.split(' ');
  const titleWords = words.slice(0, 3).join(' ');
  return titleWords.charAt(0).toUpperCase() + titleWords.slice(1);
}

module.exports = router;
