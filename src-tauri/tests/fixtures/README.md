The public localhost certificate tests PEM parsing only. Live TLS tests create
a fresh, short-lived certificate and key in memory with rcgen on every run,
so they do not depend on an expiring committed server certificate.
