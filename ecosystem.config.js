module.exports = {
  apps: [
    {
      name: 'multi-tetris',
      script: './server/server.js',
      
      // Server Configuration
      env: {
        NODE_ENV: 'development',
        HOST: '0.0.0.0',        // Server host IP (0.0.0.0 for all interfaces)
        PORT: 3001,             // Server port
        PUBLIC_HOST: 'localhost'  // Public hostname/IP for client connections (auto-constructs PUBLIC_URL)
      },
      
      // Production Environment
      env_production: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',        // Production server host
        PORT: 3001,             // Production port
        PUBLIC_HOST: 'your-server-ip'  // Change this to your actual server IP/domain
      },
      
      // Development Environment  
      env_development: {
        NODE_ENV: 'development',
        HOST: 'localhost',      // Development host
        PORT: 3001,             // Development port
        PUBLIC_HOST: 'localhost'  // Public hostname for development
      },
      
      // PM2 Settings
      instances: 1,             // Number of instances (1 for single instance)
      autorestart: true,        // Auto restart on crash
      watch: false,             // Set to true for development auto-reload
      max_memory_restart: '1G', // Restart if memory usage exceeds 1GB
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced Settings
      exec_mode: 'fork',        // Execution mode (fork or cluster)
      min_uptime: '10s',        // Minimum uptime before considering stable
      max_restarts: 10,         // Maximum number of restarts within listen_timeout
      kill_timeout: 5000,       // Time to wait before force killing
      
      // Environment Variables Comments:
      // HOST: IP address to bind the server (0.0.0.0 for all interfaces, localhost for local only)
      // PORT: Port number for the server to listen on
      // PUBLIC_HOST: Hostname/IP that clients will use to connect (automatically creates PUBLIC_URL as http://PUBLIC_HOST:PORT)
    }
  ]
};

/*
Usage Instructions:

1. Development mode (default):
   pm2 start ecosystem.config.js

2. Production mode:
   pm2 start ecosystem.config.js --env production

3. Custom configuration:
   Edit the env section above and restart:
   pm2 restart ecosystem.config.js

4. Stop the application:
   pm2 stop multi-tetris

5. Delete the application:
   pm2 delete multi-tetris

6. View logs:
   pm2 logs multi-tetris

7. Monitor:
   pm2 monit

Configuration Notes:
- Change HOST to '0.0.0.0' to accept connections from any IP address
- Change HOST to 'localhost' or '127.0.0.1' for local connections only  
- Update PUBLIC_HOST to match your server's actual IP address for external access
- PUBLIC_URL is automatically constructed as http://PUBLIC_HOST:PORT
- For Rocky Linux deployment, just change PUBLIC_HOST in the production env section

Example configurations:
- Local development: PUBLIC_HOST: 'localhost'
- Network access: PUBLIC_HOST: '192.168.1.100' 
- Rocky Linux server: PUBLIC_HOST: 'your-rocky-server.com' or '192.168.1.50'
*/
