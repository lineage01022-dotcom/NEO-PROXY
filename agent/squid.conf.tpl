# Squid baseline template (rendered by agent at install time)
auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwd
auth_param basic realm proxyhub
acl authenticated proxy_auth REQUIRED
http_access allow authenticated
http_access deny all
http_port 3128
visible_hostname proxyhub
forwarded_for delete
via off
# --- proxyhub-managed-start ---
# --- proxyhub-managed-end ---
