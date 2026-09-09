UPDATE users
SET password_hash = '8Ti9kiMPC4JtIw0BpADZla5qdP6LT52NdBZ2mVxxLqQ=',
    password_salt = 'I8CGppMj/vdRTJC2BvKPnA==',
    password_iterations = 100000
WHERE email = 'services@finvayo.com';

DELETE FROM sessions
WHERE user_id = (SELECT id FROM users WHERE email = 'services@finvayo.com');
