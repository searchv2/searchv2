using LoadBalancer;

var builder = WebApplication.CreateBuilder(args);

var backends = builder.Configuration.GetSection("LoadBalancing:Backends").Get<string[]>()
    ?? throw new InvalidOperationException("No backends configured under LoadBalancing:Backends.");

builder.Services.AddSingleton(new RandomSelector(backends));
builder.Services.AddControllers();

var app = builder.Build();

app.MapControllers();

app.Run();
