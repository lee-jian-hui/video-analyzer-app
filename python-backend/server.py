import grpc
from concurrent import futures
import api_pb2
import api_pb2_grpc
import logging
from grpc_reflection.v1alpha import reflection

class MyApiService(api_pb2_grpc.MyApiServiceServicer):
    def GetData(self, request, context):
        query = request.query

        # Simple response based on query
        if query == "hello":
            result = "Hello from Python gRPC server!"
        elif query == "time":
            import datetime
            result = f"Current time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        elif query == "users":
            result = "Users: Alice, Bob, Charlie"
        elif query == "":
            result = "No query provided"
        else:
            result = f"You asked for: {query}. This is a response from the Python backend!"

        return api_pb2.DataResponse(result=result)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    api_pb2_grpc.add_MyApiServiceServicer_to_server(MyApiService(), server)

    listen_addr = '[::]:50051'
    server.add_insecure_port(listen_addr)

    logging.basicConfig(level=logging.INFO)
    logging.info(f"Starting gRPC server on {listen_addr}")

    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()