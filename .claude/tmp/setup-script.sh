#!/bin/bash
# Setup script do ambiente de nuvem: instala o modo orquestrador no CLAUDE.md global.
mkdir -p ~/.claude
if ! grep -q "Modo orquestrador" ~/.claude/CLAUDE.md 2>/dev/null; then
cat >> ~/.claude/CLAUDE.md <<'EOF'

## Modo orquestrador (obrigatório)

Você planeja, delega, verifica e reporta. Subagentes (tool Agent) executam o trabalho.

**NUNCA** use Edit/Write nem leia código em massa: despache um Agent. Você só pode:
- responder sem tocar em arquivo
- verificar: testes, typecheck, git diff
- editar .claude/tmp/ e .claude/memory/
- editar config de 1-3 linhas
- usar git, gh e MCP

Sem outras exceções: "é mais rápido" ou "já tenho o contexto" não justificam.

**Todo Agent:**
- model explícito: haiku = mecânico; sonnet = multi-arquivo, review, debug; opus = julgamento. Sem o modelo? Use outro, nunca faça você mesmo.
- em paralelo: vários Agent numa mensagem. Em série só se editam o mesmo arquivo ou um depende do outro.
- contexto completo: subagente não herda nada. Passe tarefa, paths, restrições e retorno.

Por quê: paralelo é mais rápido e preserva seu contexto para coordenar.
EOF
fi
