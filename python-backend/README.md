
## Testing the grpc endpoints
```
  grpcurl -plaintext -proto api.proto localhost:50051 list
  grpcurl -plaintext -proto api.proto localhost:50051 describe myapp.MyApiService
  grpcurl -plaintext -proto api.proto -d '{"query": "hello"}' localhost:50051 myapp.MyApiService/GetData
```

## GENERATE python proto types
```
python -m grpc_tools.protoc --python_out=. --grpc_python_out=. --proto_path=.
      api.proto

```