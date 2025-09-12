# Multi-User Tetris Deployment Guide

This document provides various methods to deploy the multi-user Tetris game on different hosting platforms.

## Prerequisites

- Node.js 16+ installed
- Git repository access
- Domain name (optional but recommended)

## Deployment Options

### 1. Heroku (Free Tier Available)

#### Setup
1. Install Heroku CLI: `npm install -g heroku`
2. Login: `heroku login`
3. Create app: `heroku create your-tetris-app-name`

#### Configuration
```bash
# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set HOST=0.0.0.0
heroku config:set PORT=443

# Deploy
git push heroku main
```

#### Procfile (create in project root)
```
web: node server/server.js
```

### 2. Railway (Modern Alternative to Heroku)

#### Setup
1. Connect GitHub repository to Railway
2. Auto-deploy on push to main branch
3. Environment variables:
   - `NODE_ENV=production`
   - `HOST=0.0.0.0`
   - `PORT=$PORT` (Railway provides this)

### 3. Render (Free Static + Paid Backend)

#### Setup
1. Create new Web Service on Render
2. Connect GitHub repository
3. Build command: `npm install`
4. Start command: `node server/server.js`
5. Environment variables:
   - `NODE_ENV=production`
   - `HOST=0.0.0.0`

### 4. DigitalOcean Droplet (VPS)

#### Initial Setup
```bash
# Create droplet with Ubuntu 22.04
# SSH into droplet
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install Git
apt install git -y
```

#### Deployment
```bash
# Clone repository
git clone https://github.com/ahe24/multi_tet1.git
cd multi_tet1

# Install dependencies
npm install

# Start with PM2 (production)
pm2 start ecosystem.config.js

# Setup PM2 to start on boot
pm2 startup
pm2 save
```

#### Nginx Setup (Optional - for custom domain)
```bash
# Install Nginx
apt install nginx -y

# Create site configuration
nano /etc/nginx/sites-available/tetris

# Add configuration:
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
ln -s /etc/nginx/sites-available/tetris /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 5. AWS EC2

#### Launch Instance
1. Launch EC2 instance (t3.micro for testing)
2. Select Ubuntu 22.04 AMI
3. Configure security group (ports 22, 80, 443, 3000)

#### Setup (same as DigitalOcean)
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@ec2-instance-ip

# Follow same Node.js setup as DigitalOcean
# Install Node.js, PM2, clone repo, etc.
```

### 6. Google Cloud Platform (GCP)

#### Cloud Run (Serverless)
1. Create Dockerfile:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

CMD ["node", "server/server.js"]
```

2. Deploy:
```bash
gcloud run deploy tetris-game \
  --source . \
  --port 3000 \
  --allow-unauthenticated \
  --region us-central1
```

#### Compute Engine (VM)
Similar to DigitalOcean/AWS EC2 setup

### 7. Vercel (Frontend + Serverless)

Note: Requires modification for serverless functions

#### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server/server.js"
    }
  ]
}
```

### 8. Local Network Deployment

#### For LAN Gaming
```bash
# Find your local IP
ip addr show  # Linux
ipconfig      # Windows

# Set HOST to your local IP
export HOST=192.168.1.100  # Your actual IP
export PORT=3000
node server/server.js

# Access from other devices: http://192.168.1.100:3000
```

## Environment Variables

Set these for production deployment:

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3000  # or platform-provided port
PUBLIC_HOST=your-domain.com  # your actual domain
```

## SSL/HTTPS Setup

### Let's Encrypt (Free SSL)
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get certificate
certbot --nginx -d your-domain.com

# Auto-renewal
crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring & Maintenance

### PM2 Commands
```bash
pm2 list                 # View running processes
pm2 logs tetris         # View logs
pm2 restart tetris     # Restart app
pm2 stop tetris        # Stop app
pm2 delete tetris      # Remove app
```

### Health Checks
- Monitor server uptime
- Check WebSocket connections
- Monitor memory usage
- Set up log rotation

## Recommended Platforms

### For Beginners
1. **Railway** - Easiest deployment, GitHub integration
2. **Render** - Free tier, simple setup
3. **Heroku** - Well-documented, many tutorials

### For Production
1. **DigitalOcean** - Reliable, good performance
2. **AWS EC2** - Scalable, enterprise-grade
3. **Google Cloud** - Modern infrastructure

### For Cost-Effective
1. **Railway** - Generous free tier
2. **Render** - Free for static, affordable for dynamic
3. **Local VPS** - Most control, lowest cost

## Troubleshooting

### Common Issues
1. **Port binding errors**: Ensure HOST=0.0.0.0
2. **WebSocket failures**: Check proxy configuration
3. **Memory issues**: Monitor with `pm2 monit`
4. **SSL problems**: Verify certificate installation

### Performance Optimization
- Enable gzip compression
- Use Redis for session storage (if scaling)
- Implement rate limiting
- Add CDN for static assets