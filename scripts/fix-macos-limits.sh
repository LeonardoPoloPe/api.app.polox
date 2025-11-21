#!/bin/bash
# Script para corrigir limites de file descriptors no macOS

echo "🔧 Corrigindo limites de file descriptors no macOS..."

# Aumentar limite temporário para esta sessão
ulimit -Sn 10240
echo "✅ Limite soft definido para 10240"

# Verificar limite atual
CURRENT_LIMIT=$(ulimit -n)
echo "📊 Limite atual: $CURRENT_LIMIT"

# Criar arquivo de configuração permanente se não existir
LAUNCHD_CONF="/Library/LaunchDaemons/limit.maxfiles.plist"

if [ ! -f "$LAUNCHD_CONF" ]; then
    echo ""
    echo "⚠️  Para tornar permanente, execute como administrador:"
    echo ""
    echo "sudo tee $LAUNCHD_CONF << EOF"
    cat << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>limit.maxfiles</string>
    <key>ProgramArguments</key>
    <array>
      <string>launchctl</string>
      <string>limit</string>
      <string>maxfiles</string>
      <string>65536</string>
      <string>200000</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ServiceIPC</key>
    <false/>
  </dict>
</plist>
EOF
    echo ""
    echo "sudo launchctl load -w $LAUNCHD_CONF"
    echo ""
fi

echo ""
echo "✅ Configuração temporária aplicada!"
echo "💡 Para deploy, use: npm run deploy:dev (o limite já está incluído)"
