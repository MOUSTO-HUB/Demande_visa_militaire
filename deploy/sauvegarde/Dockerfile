# Sauvegarde : outils PostgreSQL 17 (même version que la base) et GnuPG pour chiffrer.
FROM postgres:17-alpine
RUN apk add --no-cache gnupg
COPY sauvegarde.sh restaurer.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/sauvegarde.sh /usr/local/bin/restaurer.sh
ENTRYPOINT ["sauvegarde.sh"]
