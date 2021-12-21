## 채팅내역 보존

---

### 1.문제정의
-기존 socket.io를 그대로 사용한다면 채팅내역들이 모두 휘발되어 내역을 볼 수 없다.

### 2.사실수집
- socket.io는 신호를 매개로 주고 받는다.
- 이때 해당 신호에 맞춰 데이터(채팅내역)을 주고 받고 실행한 탭(쓰레드)을 껐다 다시 켜게 되면 모두 휘발되어 빈화면이 나왔다.

### 3.원인추론
- 활성화 된 탭내에서는 데이터가 있는걸로 보였지만 DB에 데이터를 추가,저장,삭제 하는 일련의 과정들이 없어 데이터들이 휘발되었다.

### 4.조사방법결정
- Node.js에 DB인 Oracle을 결합하여 DB를 통해 데이터의 입력,출력을 하는법을 찾았다.

### 5.조사방법구현
```
var oracledb = require('oracledb');
oracledb.autoCommit = true;

try {
    oracledb.initOracleClient({
        libDir: 'C:/instantclient_18_5'
    })
} catch (err) {
    console.error('Whoops!');
    console.error(err);
    process.exit(1);
}

var conn;
//오라클 접속
oracledb.getConnection({
    user: "id-example",
    password: "pw-example",
    connectString: "1.234.5.158:11521/xe"
}, function(err, con) {
    console.log(con);
    if (err) {
        console.log("접속이 실패했습니다.", err);
    }
    global.conn = con;
    console.log('global conn', global.conn);

    conn = global.conn;

});
```
- OracleDB를 연결하기위한 외부 파일을 oracle사이트에서 설치받은후 해당 파일을 위치를 기입하고
- 해당 DB의 계정정보를 기입하여 연결시켜주었다.
- cmd창을 통해 app.js를 실행시킨후 cmd창을 보게되면 오라클의 접속을 알 수 있다.

### 6.문제해결
- socket.io에 Oracle DB를 연결함으로써 데이터 보존에 성공


## socket.io 데이터 송신시의 문제
### 1.문제정의
- socket.io를 이용한 vue, 프론트에서 
