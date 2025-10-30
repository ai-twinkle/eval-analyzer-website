import { ConfigProvider, App as AntApp } from 'antd';
import { Home } from './pages/Home';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntApp>
        <Home />
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
