import { User, Job, Reward, ServiceCategory } from '../types';

// Users list cleared as requested. New users will be created via Auth.
export const MOCK_USERS: User[] = [];

export const CATEGORIES: ServiceCategory[] = [
  { id: '1', name: 'Pedreiro', icon: 'BrickWall' },
  { id: '2', name: 'Eletricista', icon: 'Zap' },
  { id: '3', name: 'Encanador', icon: 'Wrench' },
  { id: '4', name: 'Pintor', icon: 'PaintBucket' },
  { id: '5', name: 'Jardinagem', icon: 'Sprout' },
  { id: '6', name: 'Montador', icon: 'Hammer' },
  { id: '7', name: 'Limpeza', icon: 'Sparkles' },
  { id: '8', name: 'Serviços Gerais', icon: 'Briefcase' },
];

export const MOCK_JOBS: Job[] = [
  {
    id: 'j1',
    title: 'Instalação de Tomadas',
    clientName: 'Maria Silva',
    clientId: '101',
    workerName: 'Agro Tecno',
    workerId: '3',
    status: 'completed',
    price: 150.00,
    date: '2023-10-15',
    rating: 5,
    workerEvidence: 'https://picsum.photos/300/200?random=11',
    estimatedHours: 2
  },
  {
    id: 'j2',
    title: 'Reparo em Telhado',
    clientName: 'Geraldo Junior',
    clientId: '2',
    workerName: 'João Pedreiro',
    status: 'pending',
    price: 350.00,
    date: '2023-10-28',
    estimatedHours: 4
  },
  {
    id: 'j3',
    title: 'Capina de Lote',
    clientName: 'Empresa X',
    clientId: '102',
    status: 'in_progress',
    price: 200.00,
    date: '2023-10-27',
    estimatedHours: 8
  }
];

export const CLIENT_REWARDS: Reward[] = [
  { id: 'r1', title: 'R$ 20,00 de Desconto', cost: 100, type: 'discount', image: 'https://picsum.photos/200/200?random=20', partnerName: 'MÃO DE OBRA' },
  { id: 'r2', title: 'R$ 50,00 de Desconto', cost: 250, type: 'discount', image: 'https://picsum.photos/200/200?random=21', partnerName: 'MÃO DE OBRA' },
];

export const WORKER_REWARDS: Reward[] = [
  { id: 'w1', title: 'Parafusadeira Philco', cost: 1000, type: 'product', image: 'https://www.armazemparaiba.com.br/ccstore/v1/images/?source=/file/v9208948547820345869/products/0100011944630006.7da8157d0cf557344cb42a2ec06a588bb106d03f.jpg&height=475&width=475', partnerName: 'Casa & Construção' },
  { id: 'w2', title: 'Lata de Tinta 18L', cost: 800, type: 'product', image: 'https://picsum.photos/200/200?random=31', partnerName: 'Tintas Coral' },
  { id: 'w3', title: 'Kit Ferramentas', cost: 500, type: 'product', image: 'https://picsum.photos/200/200?random=32', partnerName: 'Mundo das Ferramentas' },
];