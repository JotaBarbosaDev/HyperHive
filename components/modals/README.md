# CreateVmModal - Modal de Criação de Máquinas Virtuais

Modal completo para criar máquinas virtuais no HyperHive com suporte a configurações básicas e avançadas de CPU.

## Features

- ✅ Campos básicos (Nome, Slave, vCPU, Memória, Disco, Network, NFS Share, ISO)
- ✅ Checkboxes de configuração (Auto-start, Windows VM, Live VM)
- ✅ Campo de senha VNC (com geração automática opcional)
- ✅ Configuração avançada de CPU (condicional - apenas para Live VMs)
  - Seleção de múltiplos slaves para comparação
  - Botão "Get Mutual CPUs" para buscar configuração compatível
  - Editor de XML da CPU com syntax highlighting
  - Botões para copiar e limpar XML
- ✅ Validações de campos obrigatórios
- ✅ Design responsivo (mobile e web)
- ✅ Tema dark/light mode compatível
- ✅ Toast notifications para feedback
- ✅ Scroll view para conteúdo extenso

## Uso Básico

```tsx
import CreateVmModal from "@/components/modals/CreateVmModal";

function VirtualMachinesScreen() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button onPress={() => setShowModal(true)}>
        <ButtonText>Nova VM</ButtonText>
      </Button>

      <CreateVmModal
        showModal={showModal}
        setShowModal={setShowModal}
        onSuccess={() => {
          // Callback executado após criação bem-sucedida
          console.log("VM criada com sucesso!");
          // Refresh lista de VMs, etc
        }}
      />
    </>
  );
}
```

## Props

| Prop | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `showModal` | `boolean` | ✅ | Controla visibilidade do modal |
| `setShowModal` | `(show: boolean) => void` | ✅ | Função para alterar visibilidade |
| `onSuccess` | `() => void` | ❌ | Callback executado após criação bem-sucedida |

## Estrutura de Dados

O modal envia os seguintes dados para criação da VM:

```typescript
{
  machine_name: string;        // Slave selecionado
  name: string;               // Nome da VM
  memory: number;             // Memória em MB
  vcpu: number;               // Número de vCPUs
  disk_sizeGB: number;        // Tamanho do disco em GB
  iso_id?: number;            // ID do ISO (opcional)
  nfs_share_id: number;       // ID do NFS Share
  network: string;            // Nome da network
  VNC_password: string;       // Senha VNC (vazio = auto)
  live: boolean;              // Live VM flag
  cpu_xml: string;            // XML de configuração da CPU
  auto_start: boolean;        // Auto-start no boot
  is_windows: boolean;        // Windows VM flag
}
```

## Seções do Modal

### 1. Campos Básicos (Grid 2 colunas)
- Nome da VM
- Slave
- vCPU
- Memória (MB)
- Disco (GB)
- Network
- NFS Share ID
- ISO ID (opcional)

### 2. Checkboxes
- Auto-start ao boot do slave
- Windows VM
- Live VM

### 3. VNC Password
- Campo de senha com opção de deixar vazio para gerar automaticamente

### 4. Configuração Avançada de CPU (apenas se Live VM = true)
- Lista de slaves selecionados (badges removíveis)
- Dropdown para adicionar slaves à comparação
- Botão "Get Mutual CPUs" (com loading state)
- TextArea para visualizar/editar XML da CPU
- Botões para copiar e limpar XML

## Design

- **Cores**: Sistema monocromático seguindo o design do HyperHive
- **Backgrounds**: `bg-background-0`, `bg-background-50`, `bg-[#0F1A2E]`
- **Borders**: `border-outline-200`, `dark:border-[#2A3B52]`
- **Textos**: `text-typography-900`, `dark:text-[#E8EBF0]`
- **XML**: Fundo escuro com texto verde (`text-[#22C55E]`)
- **Fonte**: Inter (títulos: Bold/SemiBold, textos: Regular)

## Responsividade

- **Mobile**: Layout em coluna única
- **Web**: Grid de 2 colunas para campos básicos
- **Modal**: `max-w-[90%]` e `max-h-[90%]` com scroll interno

## Validações

1. **Nome** e **NFS Share ID** são obrigatórios
2. Botão "Get Mutual CPUs" desabilitado se nenhum slave selecionado
3. Botões Copy/Clear XML desabilitados se XML vazio
4. Seção de CPU só aparece se checkbox "Live VM" marcado

## Notas Técnicas

- Utiliza `expo-clipboard` com fallback para compatibilidade
- Loading state no botão "Get Mutual CPUs"
- Toast notifications para feedback de sucesso/erro
- Reset automático do formulário após criação
- Mock XML fornecido como exemplo (substituir por chamada real à API)

## Próximos Passos (API Integration)

Substituir o mock no `handleCreate()` e `handleGetMutualCPUs()` por chamadas reais:

```typescript
// Exemplo de integração
const handleCreate = async () => {
  try {
    await api.post('/vms', vmData);
    // ...
  } catch (error) {
    // ...
  }
};

const handleGetMutualCPUs = async () => {
  try {
    const response = await api.post('/vms/mutual-cpus', {
      slaves: selectedSlaves
    });
    setCpuXml(response.data.cpu_xml);
    // ...
  } catch (error) {
    // ...
  }
};
```
