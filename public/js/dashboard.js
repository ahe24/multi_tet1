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
        this.allTimeTableBody = document.getElementById('allTimeTableBody');
        this.recentSessionsBody = document.getElementById('recentSessionsBody');
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
        const { topPlayers, allPlayers, topPlayersAllTime, recentSessions } = data;
        
        this.totalPlayersEl.textContent = allPlayers.length;
        
        const activePlayers = allPlayers.filter(p => p.status === 'playing');
        this.activeGamesEl.textContent = activePlayers.length;
        
        const highestScore = allPlayers.length > 0 
            ? Math.max(...allPlayers.map(p => p.score))
            : 0;
        this.highestScoreEl.textContent = highestScore.toLocaleString();
        
        this.updatePlayersTable(allPlayers);
        
        if (topPlayersAllTime) {
            this.updateAllTimeTable(topPlayersAllTime);
        }
        
        if (recentSessions) {
            this.updateRecentSessionsTable(recentSessions);
        }
    }
    
    updatePlayersTable(players) {
        this.playersTableBody.innerHTML = '';
        
        players.forEach((player, index) => {
            const row = document.createElement('tr');
            row.className = player.status === 'playing' ? 'active-player' : 'inactive-player';
            
            const joinDateTime = new Date(player.joinTime);
            const joinTimeStr = joinDateTime.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' ' + joinDateTime.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
            const statusIcon = player.status === 'playing' ? '🎮' : '💀';
            
            row.innerHTML = `
                <td class="rank">${index + 1}</td>
                <td class="player-name">
                    ${player.name}
                    <span class="player-id">(${player.id.substring(0, 8)}...)</span>
                </td>
                <td class="score">${player.score.toLocaleString()}</td>
                <td class="lines">${player.lines}</td>
                <td class="status">
                    <span class="status-icon">${statusIcon}</span>
                    ${player.status}
                </td>
                <td class="join-time">${joinTimeStr}</td>
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
    
    updateAllTimeTable(players) {
        if (!this.allTimeTableBody) return;
        
        this.allTimeTableBody.innerHTML = '';
        
        players.forEach((player, index) => {
            const row = document.createElement('tr');
            const lastPlayedDate = new Date(player.last_played);
            const lastPlayedStr = lastPlayedDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' ' + lastPlayedDate.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
            
            row.innerHTML = `
                <td class="rank">${index + 1}</td>
                <td class="player-name">${player.name}</td>
                <td class="score">${player.high_score.toLocaleString()}</td>
                <td class="lines">${player.total_lines.toLocaleString()}</td>
                <td class="games">${player.total_games}</td>
                <td class="last-played">${lastPlayedStr}</td>
            `;
            
            this.allTimeTableBody.appendChild(row);
        });
        
        if (players.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="7" class="no-players">기록된 플레이어가 없습니다</td>
            `;
            this.allTimeTableBody.appendChild(row);
        }
    }

    updateRecentSessionsTable(sessions) {
        if (!this.recentSessionsBody) return;
        
        this.recentSessionsBody.innerHTML = '';
        
        sessions.forEach((session, index) => {
            const row = document.createElement('tr');
            const endedDate = new Date(session.ended_at);
            const endedStr = endedDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' ' + endedDate.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
            const duration = session.duration ? this.formatDuration(session.duration) : '미완료';
            
            row.innerHTML = `
                <td class="rank">${index + 1}</td>
                <td class="player-name">${session.player_name}</td>
                <td class="score">${session.score.toLocaleString()}</td>
                <td class="lines">${session.lines}</td>
                <td class="duration">${duration}</td>
                <td class="ended-at">${endedStr}</td>
            `;
            
            this.recentSessionsBody.appendChild(row);
        });
        
        if (sessions.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="7" class="no-players">최근 세션이 없습니다</td>
            `;
            this.recentSessionsBody.appendChild(row);
        }
    }

    formatDuration(seconds) {
        if (seconds < 60) {
            return `${seconds}초`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}분 ${secs}초`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}시간 ${minutes}분`;
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