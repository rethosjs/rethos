import { RouteObject } from 'react-router-dom';
import { SimpleCounterPage } from './pages/examples/simple-counter';
import { ListPage } from 'pages/examples/list';

export interface SuperRouteObject extends RouteObject {
  name: string;
}

export const routes: SuperRouteObject[] = [
  {
    name: '简单累加器',
    path: '/',
    element: <SimpleCounterPage />,
  },
  { name: '列表', path: 'team', element: <ListPage /> },
];