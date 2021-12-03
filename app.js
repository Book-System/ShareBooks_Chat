var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var app = express();

var usersRouter = require('./routes/users');
// var chatingRouter = require('./routes/chating');
// var searchRouter = require('./routes/search');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/users', usersRouter);

app.use(function(req, res, next) {
    next(createError(404));
});

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
    user: "id318",
    password: "pw318",
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


// CMD> npm install socket.io --save
// express는 app변수 -> http -> socket.io 연결
var http = require('http').createServer(app);
app.io = require('socket.io')(http, {
    cors: {
        origins: '*:*',
        methods: ['GET', "POST"]
    }
});

// 클라이언트(vue, react, android 등)이 접속했을때
app.io.on('connection', function(socket) {
    // 접속한 소켓 정보 확인(회원판별)
    console.log(`connection1 ${socket.id}`);

    // 클라이언트에서 데이터(문자, 파일)가 전송되었을때
    socket.on('publish', function(data) {
        // 전송된 데이터 출력

        var id = data.data.username;
        var chat = data.data.userid;
        var code = data.data.code;
        var room = data.data.room;
        var room1 = data.data.room1;
        var room2 = data.data.room2;
        var regdate = data.data.regdate;
        var flag = data.data.flag;



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
            conn.execute("insert into CHAT(CHATING,USERID,CODE,ROOM,ROOM1,ROOM2,REGDATE,FLAG) values('" + chat + "','" + id + "','" + code + "','" + room + "','" + room1 + "','" + room2 + "','" + regdate + "','" + flag + "')", function(err, result) {
                if (err) {
                    console.log("글저장중 오류가 발생했습니다");
                } else {
                    console.log("글저장 결과 :", result);
                }
            })
        }



        //코드 5 - 거래 완료 버튼 누를시 대화내용 삭제
        if (data.data.code === 5) {
            flag2 += data.data.flag;
            console.log(flag2);
            if (flag2 === 1) {
                app.io.to(room).emit('subscribe', {
                    userjoin: 1,
                    username: "자리를 비웠습니다"
                })
                socket.leave(room);
                data.data.flag = false;
            } else if (flag2 === 2) {
                conn.execute("delete from CHAT where ROOM=" + room, function(err, result) {
                    if (err) {
                        console.log("채팅방 삭제 중 오류가 발생했습니다");
                    } else {
                        console.log("글이 종료 되었습니다")
                        console.log(result);
                        app.io.to(room).emit('subscribe', {
                            userjoin: 1,
                            username: "거래를 종료 했습니다"
                        })
                        socket.leave(room);
                        flag2 = 0;
                    }
                })
            }
        }

        //코드 6 아이디 접속시 방목록 호출
        if (data.data.code === 6) {

            conn.execute(`SELECT ROOM1,ROOM2, ROOM,OPPONENT FROM CHAT WHERE ROOM1='${data.data.username}' OR ROOM2='${data.data.username}' GROUP BY ROOM1,ROOM2,ROOM,OPPONENT`, function(err, result) {
                if (err) {
                    console.log(err);
                    console.log("채팅방 호출중 오류가 발생했습니다");
                } else {
                    console.log("result결과입니다 :", result);

                    for (let i = 0; i < result.rows.length; i++) {
                        var room1 = result.rows[i][0];
                        var room2 = result.rows[i][1];
                        var room = result.rows[i][2];
                        // var userId = result.rows[i][3];
                        var opponent = result.rows[i][3];
                        console.log("판매자", room1);
                        console.log("구매자", room2);
                        console.log("방이름", room);
                        // console.log("채팅친사람",userId);
                        console.log("상대방,빈값으로올것임", opponent)
                        app.io.to(socket.id).emit('subscribe1', {
                            room1: room1,
                            room2: room2,
                            room: room,
                            opponent: opponent
                        })
                    }
                }
            })

        }
    });

    //실시간 검색 및 실시간 차트 반영
    socket.on('search', function(data) {
        console.log(data);
        if (data.data.code === 2) {
            //데이터 송신시, 검색어 입력시 기존에 있는지 없는지 확인후
            //있으면 count수정/없으면 데이터삽입
            conn.execute("select count from CHART WHERE SEARCH='" + data.data.search + "'", function(err, result) {
                if (err) {
                    console.log("글 조회에 실패했습니다");
                } else {
                    if (result.rows.length === 0) {
                        conn.execute("insert into CHART(SEARCH, COUNT) values('" + data.data.search + "','" + data.data.count + "')", function(err, result) {
                            if (err) {
                                console.log("검색어 입력중 오류가 발생했습니다");
                            } else {
                                console.log("result :", result);
                                conn.execute("select * from CHART order by count desc ", function(err, result) {
                                    if (err) {
                                        console.log("글 호출중 오류가 발생했습니다");
                                    } else {


                                        console.log("result :", result);

                                        const arr = [];
                                        for (let i = 0; i < 10; i++) {
                                            search1 = result.rows[i][0];
                                            count1 = result.rows[i][1];
                                            rank1 = data.data.rank + i + 1;
                                            arr.push({
                                                search: search1,
                                                count: count1,
                                                rank: rank1
                                            });
                                        }

                                        console.log(arr);

                                        app.io.to(socket.id).emit('Ssubscribe', arr);
                                    }
                                })

                            }
                        })
                    } else {
                        conn.execute("update CHART set COUNT=COUNT+1 WHERE SEARCH ='" + data.data.search + "'", function(err, result) {
                            if (err) {
                                console.log(err);
                                console.log("검색어 수정중 오류가 발생했습니다");
                            } else {
                                console.log("result :", result);
                                conn.execute("select * from CHART order by count desc ", function(err, result) {
                                    if (err) {
                                        console.log("글 호출중 오류가 발생했습니다");
                                    } else {
                                        console.log("result :", result);

                                        const arr = [];
                                        for (let i = 0; i < 10; i++) {
                                            search1 = result.rows[i][0];
                                            count1 = result.rows[i][1];
                                            rank1 = i + 1;
                                            arr.push({
                                                search: search1,
                                                count: count1,
                                                rank: rank1
                                            });
                                        }
                                        console.log(arr);

                                        app.io.to(socket.id).emit('Ssubscribe', arr);

                                    }
                                })
                            }
                        })
                    }
                }

            })
        } else if (data.data.code === 1) { //입장시 데이터 조회 (인기검색어)
            conn.execute("select * from CHART order by count desc ", function(err, result) {
                if (err) {
                    console.log("글 호출중 오류가 발생했습니다");
                } else {
                    console.log("result :", result);
                    const arr = [];
                    for (let i = 0; i < 10; i++) {
                        search1 = result.rows[i][0];
                        count1 = result.rows[i][1];
                        rank1 = i + 1;

                        arr.push({
                            search: search1,
                            count: count1,
                            rank: rank1
                        });
                    }

                    console.log(arr);

                    app.io.to(socket.id).emit('Ssubscribe', arr);
                }
            })
        }


    });
    socket.on('chart', function(data) {
        if (data.data.code === 4) { // 입장시 차트 데이터 조회
            conn.execute("select SELLERID,REGDATE,COUNT from RESERVATION WHERE SELLERID= '" + data.data.sellerId + "' ORDER BY REGDATE ASC" , function(err, result) {
                if (err) {
                    console.log("글 조회에 실패했습니다");
                } else {
                    console.log("입장 차트 결과:", result);
                    console.log("머요",data.data.sellerId);
                    const arr = [];
                    for (let i = 0; i < result.rows.length; i++) {
                        sellerId1 = result.rows[i][0];
                        regdate1 = result.rows[i][1];
                        count1 = result.rows[i][2];


                        arr.push({
                            sellerId: sellerId1,
                            count: count1,
                            regdate: regdate1,
                            flag: 2
                        });
                    }
                    app.io.to(socket.id).emit('Searchsubscribe', arr);
                }
            })
        } else if (data.data.code === 3) { //그래프 차트
            conn.execute("select * from RESERVATION WHERE SELLERID= '" + data.data.sellerId + "' ORDER BY REGDATE ASC", function(err, result) {
                if (err) {
                    console.log("글 조회에 실패했습니다");
                } else {
                    console.log("result :", result);
                    //아이디 같은게 없는경우
                    if (result.rows.length === 0) {
                        //추가해주기
                        conn.execute("insert into RESERVATION(SELLERID, REGDATE,COUNT) values('" + data.data.sellerId + "','" + data.data.regdate + "','" + data.data.count + "')", function(err, result) {
                            if (err) {
                                console.log("아이디 같은게 없는경우 추가중 오류가 발생했습니다");
                            } else {
                                console.log("result :", result);
                                conn.execute("select * from RESERVATION WHERE SELLERID= '" + data.data.sellerId + "' ORDER BY REGDATE ASC", function(err, result) {
                                    if (err) {
                                        console.log("예약 테이블 전체 호출중 오류가 발생했습니다");
                                    } else {
                                        console.log("result :", result);

                                        const arr = [];
                                        for (let i = 0; i < result.rows.length; i++) {
                                            sellerId1 = result.rows[i][0];
                                            regdate1 = result.rows[i][1];
                                            count1 = result.rows[i][2];


                                            arr.push({
                                                sellerId: sellerId1,
                                                count: count1,
                                                regdate: regdate1,
                                                flag: 2
                                            });
                                        }
                                        console.log(arr);
                                        app.io.to(socket.id).emit('Searchsubscribe', arr);
                                    }
                                })

                            }
                        })
                    } else //아이디 같은게 있는 경우 
                    {
                        //아이디 같은게 있는데다가 날짜까지 같은경우
                        if (result.rows[0][1] === data.data.regdate) {
                            conn.execute(`update RESERVATION set COUNT=COUNT+1 WHERE SELLERID='${data.data.sellerId}' AND REGDATE='${data.data.regdate}'`, function(err, result) {
                                if (err) {
                                    console.log("아이디와 날짜가 같은것 수정중 오류가 발생했습니다");
                                } else {
                                    console.log("result :", result);
                                    conn.execute("select * from RESERVATION WHERE SELLERID= '" + data.data.sellerId + "' ORDER BY REGDATE ASC", function(err, result) {
                                        if (err) {
                                            console.log("예약 테이블 호출중 오류가 발생했습니다");
                                        } else {
                                            console.log("result :", result);

                                            const arr = [];
                                            for (let i = 0; i < result.rows.length; i++) {
                                                sellerId1 = result.rows[i][0];
                                                regdate1 = result.rows[i][1];
                                                count1 = result.rows[i][2];


                                                arr.push({
                                                    sellerId: sellerId1,
                                                    count: count1,
                                                    regdate: regdate1,
                                                    flag: 2
                                                });
                                            }
                                            console.log(arr);
                                            app.io.to(socket.id).emit('Searchsubscribe', arr);
                                        }
                                    })
                                }
                            })
                        } else //아이디 같은게 있는데 날짜가 다른경우
                        {
                            conn.execute("insert into RESERVATION(SELLERID, REGDATE,COUNT) values('" + data.data.sellerId + "','" + data.data.regdate + "','" + data.data.count + "')", function(err, result) {
                                if (err) {
                                    console.log("아이디가 같지만 날짜가 다른것 입력중 오류가 발생했습니다");
                                } else {
                                    console.log("result :", result);
                                    conn.execute("select * from RESERVATION WHERE SELLERID= '" + data.data.sellerId + "' ORDER BY REGDATE ASC", function(err, result) {
                                        if (err) {
                                            console.log("예약 테이블 호출중 오류가 발생했습니다");
                                        } else {
                                            console.log("result :", result);

                                            const arr = [];
                                            for (let i = 0; i < result.rows.length; i++) {
                                                sellerId1 = result.rows[i][0];
                                                regdate1 = result.rows[i][1];
                                                count1 = result.rows[i][2];

                                                arr.push({
                                                    sellerId: sellerId1,
                                                    count: count1,
                                                    regdate: regdate1,
                                                    flag: 2
                                                });
                                            }
                                            console.log(arr);
                                            app.io.to(socket.id).emit('Searchsubscribe', arr);
                                        }
                                    })

                                }
                            })
                        }
                    }
                }
            })
        }
    });

});




// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;