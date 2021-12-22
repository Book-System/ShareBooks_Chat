## 채팅내역 보존

---

### 1.문제정의
- 기존 socket.io를 그대로 사용한다면 채팅내역들이 모두 휘발되어 내역을 볼 수 없다.

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
- socket.io에 Oracle DB를 연결함으로써 데이터 보존을 할 수 있게 되었다
- **[적용 후 사진]**
- ![chat cmd](https://user-images.githubusercontent.com/85853146/146928322-a86d0d68-70b4-4ad7-b686-322cec81e938.png)

---

## socket.io 데이터 송신시의 문제

### 1.문제정의
- socket.io를 이용한 vue, 프론트에서 신호를 보내줄 때 신호가 구분이 되지않았다.

### 2.사실수집
- 신호들이 같은 publish 신호로 받아져 node, 백에서는 같은 신호로 받아와졌다.

### 3.원인추론
- 모두같은 신호로 쏘아 보내졌기 때문에 즉, socket.on이 같았기 때문으로 판단했다.

### 4.조사방법결정
- 해당 신호에 code 혹은 flag같은 구분자 개념의 변수를 넣어 보내주고 백에서 해당 변수를 판단해 원하는 상태를 받게끔 하려 했다.

### 5.조사방법구현
```
leaveRoom(){
    this.$socket.emit('publish',{
        data: { 
        room : this.roomnumber2+this.roomnumber3 ,
        code:3,
        userid: this.msg,
        username: this.username } 
    });
    this.disroom = false;
    this.roomnumber1 = "";
    this.list=[];     
},
joinRoom(){

    this.$socket.emit('publish',{
        data: { 
        room : this.roomnumber2+this.roomnumber3 ,
        code:2,
        username: this.username,
        } 
    });
    this.disroom = true;                
},
join(){
    this.joined = true;
    this.$socket.emit('publish',{
        data: {
            code : 6,
            username : this.username
        }
    })
},

```
- 프론트에서는 각 신호의 상태 별로 다른 code를 넣어 주었고

```
//코드 2 - 방 가입
if (data.data.code === 2) {
    socket.join(room);
    app.io.to(room).emit('subscribe', {
        userjoin: 1,
        userid: `${id}이(가) 방에 접속했습니다`,
    });

    console.log(room);

    conn.execute("select * from CHAT where ROOM='" + String(room) + "'", function(err, result) {
        if (err) {
            console.log(err);
            console.log("글 호출중 오류가 발생했습니다");
        } else {
            console.log("result :", result);

            for (let i = 0; i < result.rows.length; i++) {
                chat = result.rows[i][0];
                id = result.rows[i][1];
                room = result.rows[0][3];
                regdate = result.rows[i][4];
                flag = result.rows[i][5];


                app.io.to(socket.id).emit('subscribe', {
                    room: room,
                    userid: chat,
                    username: id,
                    regdate: regdate,
                    flag: flag
                })
            }
        }
    })
}

//코드 3 - 방 탈퇴
if (data.data.code === 3) {
    socket.leave(room);
    app.io.to(room).emit('subscribe', {
        userjoin: 1,
        username: `${id}이(가) 자리를 떠났습니다`,
    })
}

//코드 4 - 메세지 보내기(해당 방)
if (data.data.code === 4) {
    app.io.to(data.data.room).emit('subscribe', {
        room: data.data.room,
        room1: data.data.room1,
        room2: data.data.room2,
        userid: data.data.userid,
        username: data.data.username,
        regdate: data.data.regdate,
        flag: data.data.flag,
    })
    conn.execute("insert into CHAT(CHATING,USERID,CODE,ROOM,ROOM1,ROOM2,REGDATE,FLAG) 
    values('" + chat + "','" + id + "','" + code + "','" + room + "','" + room1 + "','" + room2 + "','" + regdate + "','" + flag + "')", function(err, result) {
        if (err) {
            console.log("글저장중 오류가 발생했습니다");
        } else {
            console.log("글저장 결과 :", result);
        }
    })
}
```
- 백 에서는 해당 code를 뽑아내어 상태에 맞는 Sql문을 작성하여 구동되도록 했다.

### 6.문제해결
- 신호에 구분할수 있는 변수 code를 심어주어 이를 기준으로 해당 신호를 판별 후 알맞는 기능이 실행 되었다.

---

## 수정해 나갈점

```
if (data.data.code === 4) {
app.io.to(data.data.room).emit('subscribe', {
    room: data.data.room,
    room1: data.data.room1,
    room2: data.data.room2,
    userid: data.data.userid,
    username: data.data.username,
    regdate: data.data.regdate,
    flag: data.data.flag,
})
conn.execute("insert into CHAT(CHATING,USERID,CODE,ROOM,ROOM1,ROOM2,REGDATE,FLAG) 
values('" + chat + "','" + id + "','" + code + "','" + room + "','" + room1 + "','" + room2 + "','" + regdate + "','" + flag + "')", function(err, result) {
    if (err) {
        console.log("글저장중 오류가 발생했습니다");
    } else {
        console.log("글저장 결과 :", result);
    }
})
}
```

### 더 Restful 하게
- 통신을 위한 socket.io를 이용하였으나 다소 아쉬운점이 보인다.
- socket의 신호에 신호만을 보낸것이 아닌 데이터,값 을 보내 해당값을 가지고 가공한것
- Spring을 이용한 프로젝트기에 기존 Rest api에 기능을 추가했더라면 어땠을까 하는 생각이 든다

### 어떻게 ??
- 데이터의 추가,삭제,수정 등 일련의 과정들을 모두 Rest api로 기능을 구현한 뒤
- socket의 신호에 맞춰 해당 신호의 상태에 따라 필요한 기능을 호출했었더라면 조금더 간략하면서도 메모리를 덜 사용하는 clean code가 될 수 있었을 것 같다
- 즉, socket은 단순히 신호용 1,2,3,4 와같은 구분가능한 수로 표현을 하고
- 해당 신호에맞춰 신호에 맞는 Rest api 기능을 호출 한다는 것.
