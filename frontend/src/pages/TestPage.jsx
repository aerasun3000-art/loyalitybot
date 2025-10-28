function TestPage() {
  return (
    <div style={{ 
      padding: '40px', 
      backgroundColor: 'white', 
      minHeight: '100vh',
      color: 'black'
    }}>
      <h1 style={{ fontSize: '48px', color: 'purple', marginBottom: '20px' }}>
        🎉 Тестовая страница работает!
      </h1>
      <p style={{ fontSize: '24px', marginTop: '20px', marginBottom: '40px' }}>
        Если вы видите это сообщение, значит роутинг и деплой работают правильно.
      </p>
      <div style={{ 
        marginTop: '40px', 
        padding: '20px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '10px' 
      }}>
        <h2 style={{ fontSize: '32px', marginBottom: '10px' }}>Данные загрузки:</h2>
        <p style={{ fontSize: '18px', marginBottom: '10px' }}>
          <strong>URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'Loading...'}
        </p>
        <p style={{ fontSize: '18px', marginBottom: '10px' }}>
          <strong>Pathname:</strong> {typeof window !== 'undefined' ? window.location.pathname : 'Loading...'}
        </p>
        <p style={{ fontSize: '18px' }}>
          <strong>Search:</strong> {typeof window !== 'undefined' ? window.location.search || '(пусто)' : 'Loading...'}
        </p>
      </div>
    </div>
  );
}

export default TestPage;

