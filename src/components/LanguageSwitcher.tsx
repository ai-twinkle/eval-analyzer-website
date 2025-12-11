import React from 'react';
import { Button, Dropdown } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const currentLangLabel = i18n.language === 'en' ? 'EN' : '繁中';

  const items: MenuProps['items'] = [
    {
      key: 'en',
      label: 'English',
    },
    {
      key: 'zh-TW',
      label: '繁體中文',
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const lang = e.key;
    void i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <Dropdown menu={{ items, onClick: handleMenuClick }}>
      <Button icon={<GlobalOutlined />} size='middle'>
        {currentLangLabel}
      </Button>
    </Dropdown>
  );
};
