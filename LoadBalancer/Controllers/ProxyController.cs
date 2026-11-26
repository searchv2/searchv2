using Microsoft.AspNetCore.Mvc;

namespace LoadBalancer.Controllers;

[ApiController]
public sealed class ProxyController : ControllerBase
{
    private readonly RandomSelector _backends;

    public ProxyController(RandomSelector backends) => _backends = backends;

    // Any request, whatever the path, is redirected to the same path on a
    // randomly chosen backend. 307 keeps the method and body intact, so the
    // client re-sends its POST /api/search straight to that backend.
    [Route("{**path}")]
    public IActionResult Forward(string path)
        => RedirectPreserveMethod($"{_backends.Next()}/{path}{Request.QueryString}");
}
