module.exports = {
    apps: [{
        name: "gems-discord",
        script: "./build/index.js",
        autorestart: true,
        log_date_format : "YYYY-MM-DD HH:mm:ss",
    }]
};