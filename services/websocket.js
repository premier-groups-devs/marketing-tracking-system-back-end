const dotenv = require('dotenv');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

dotenv.config();

let wssDashboard;
const expiresInterval = parseInt(process.env.INTEXPIRETOKEN, 10);

exports.setupWebSocket = function (server) {
    wssDashboard = new WebSocket.Server({ server, path: '/ws/dashboard' });

    wssDashboard.on('connection', ws => {
        ws.on('message', message => {
            const data = JSON.parse(message);
            if (data.token) {
                ws.token = data.token;
                jwt.verify(data.token, process.env.JWT_SECRET, (err, user) => {
                    if (!err) {
                        ws.user = user;
                    } else {
                        ws.send(JSON.stringify({ message: 'Invalid token or expired session.' }));
                    }
                });
            }
        });

        ws.on('close', () => console.log('Client disconnected from /ws/dashboard'));
    });
};

exports.broadcastDashboard = function (data) {
    if (!wssDashboard) {
        console.error('wssDashboard is undefined');
        return;
    }
    wssDashboard.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

exports.getWssDashboard = function () {
    return wssDashboard;
};
