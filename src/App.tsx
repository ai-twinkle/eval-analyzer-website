import { ConfigProvider, App as AntApp } from 'antd';
import { useTranslation } from 'react-i18next';
import enUS from 'antd/locale/en_US';
import zhTW from 'antd/locale/zh_TW';
import { Home } from './pages/Home';
import './i18n/config';

function App() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'zh-TW' ? zhTW : enUS;

  return (
    <ConfigProvider
      locale={locale}
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
