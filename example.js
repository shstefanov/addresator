var cluster    = require("cluster");
var Addresator = require("./index");

if(cluster.isMaster){

  // Instantiate addressator node
  var server = new Addresator({
    id: "server",

    // It does not need to handle messages, server will just forward
    // communication between child processes - give empty function
    onMessage: function(data, cb){},

    // --
    onError:   function(err, cb){}
  });


  var counter = 3; // Counter that will countdown initialized child processes
  for(var i=0;i<3;i++){
    (function(id){
      var child = cluster.fork();
      child.once("message", function(){ // Waiting child to initiate communication
        var worker_id = "worker_"+id;
        child.send(worker_id); // Sending back child id
        

        // Create a branch
        server.branch(worker_id, function(addr_arr, data, cb_id){
          child.send([addr_arr, data, cb_id]);
        });
        child.on("message", function(data){
          server.route(data[0], data[1], data[2]);
        });
        counter--;

        // All processes are initialized - go
        if(counter===0) go(); 
      });
    })(i)
  }

  function go(){
    // Sending message 'start' to worker_1 - it will start test communication
    server.send(["worker_1"], "start");
  }


}

else{

  // 3 different processes will communicate with master process
  process.send("message"); //sending empty message - forcing server to send back my id
  process.once("message", function(worker_id){
    var worker = new Addresator({
      id: worker_id,
      onMessage: function(data, cb, remote_addr){
        console.log(worker_id+" message ", data);


        // remote_addr is address array that can be used directly to send messages back to
        // current message source
        // this  .send(remote_addr, some_data, [function(){...}])
        // worker.send(remote_addr, some_data, [function(){...}])

        // worker_1 gets messate 'start' from server
        if(this.id==="worker_1" && data==="start"){
          start();
       }
       if(this.id==="worker_2" && data==="message from [worker_1]"){
         cb(null, "response from [worker_2]")
       }
      },
      onError:   function(err){
        console.log(worker_id+" error ", err);
      }
    });
    worker.branch("server", function(addr_arr, data, cb_id){
      process.send([addr_arr, data, cb_id]);
    });
    process.on("message", function(data){
      worker.route(data[0], data[1], data[2]);
    });

    function start(){

      // I'm worker_1
      // Sending message to worker_2

      worker.send(["server", "worker_2"], "message from [worker_1]", function(err, response){
        console.log("in callback of "+worker.id, err, response);
      });
    }

  })


}