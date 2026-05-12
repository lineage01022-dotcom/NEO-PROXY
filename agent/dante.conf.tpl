# Dante baseline template (rendered by agent at install time)
logoutput: /var/log/danted.log
internal: 0.0.0.0 port = 1080
external: __EXTERNAL_IFACE__
socksmethod: username
user.privileged: root
user.unprivileged: nobody
client pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect disconnect error
}
socks pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect disconnect error
}
