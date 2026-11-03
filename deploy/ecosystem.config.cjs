// PM2 sur le VPS : le serveur de jeu, derrière nginx. `current` pointe vers
// la version déployée par scripts/deploy.sh.
module.exports = {
  apps: [
    {
      name: 'lalao',
      script: '/var/www/lalao/current/server.mjs',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '5004',
        CLIENT_DIST: '/var/www/lalao/current/client',
        MAX_ROOMS: '300',
      },
      max_memory_restart: '250M',
      time: true,
    },
  ],
};
