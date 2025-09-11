class Dashboard {
    constructor() {
        this.socket = io();
        this.setupElements();
        this.setupEventListeners();
        this.setupSocketEvents();
        this.requestDashboardData();
        
        setInterval(() => {
            this.requestDashboardData();
        }, 2000);
    }
    
    setupElements() {
        this.backToGameBtn = document.getElementById('backToGame');
        this.totalPlayersEl = document.getElementById('totalPlayers');
        this.activeGamesEl = document.getElementById('activeGames');
        this.highestScoreEl = document.getElementById('highestScore');
        this.playersTableBody = document.getElementById('playersTableBody');
    }
    
    setupEventListeners() {
        this.backToGameBtn.addEventListener('click', () => {
            window.close();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.close();
            }
        });
    }
    
    setupSocketEvents() {
        this.socket.on('dashboardData', (data) => {
            this.updateDashboard(data);
        });
        
        this.socket.on('gameUpdate', (data) => {
            this.updateDashboard(data);
        });
    }
    
    requestDashboardData() {
        this.socket.emit('getDashboard');
    }
    
    updateDashboard(data) {
        const { topPlayers, allPlayers } = data;
        
        this.totalPlayersEl.textContent = allPlayers.length;
        
        const activePlayers = allPlayers.filter(p => p.status === 'playing');
        this.activeGamesEl.textContent = activePlayers.length;
        
        const highestScore = allPlayers.length > 0 
            ? Math.max(...allPlayers.map(p => p.score))
            : 0;
        this.highestScoreEl.textContent = highestScore.toLocaleString();
        
        this.updatePlayersTable(allPlayers);
    }
    
    updatePlayersTable(players) {
        this.playersTableBody.innerHTML = '';
        
        players.forEach((player, index) => {
            const row = document.createElement('tr');
            row.className = player.status === 'playing' ? 'active-player' : 'inactive-player';
            
            const joinTime = new Date(player.joinTime).toLocaleTimeString();
            const statusIcon = player.status === 'playing' ? '🎮' : '💀';
            
            row.innerHTML = `
                <td class="rank">${index + 1}</td>
                <td class="player-name">
                    ${player.name}
                    <span class="player-id">(${player.id.substring(0, 8)}...)</span>
                </td>
                <td class="score">${player.score.toLocaleString()}</td>
                <td class="level">${player.level}</td>
                <td class="lines">${player.lines}</td>
                <td class="status">
                    <span class="status-icon">${statusIcon}</span>
                    ${player.status}
                </td>
                <td class="join-time">${joinTime}</td>
            `;
            
            this.playersTableBody.appendChild(row);
        });
        
        if (players.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="7" class="no-players">현재 접속 중인 플레이어가 없습니다</td>
            `;
            this.playersTableBody.appendChild(row);
        }
    }
    
    formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        } else {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }
    }
}

window.addEventListener('load', () => {
    new Dashboard();
});