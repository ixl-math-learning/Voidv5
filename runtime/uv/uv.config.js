// Runtime-computed UV config so this works at any jsdelivr path.
(function () {
  var B = self.location.pathname.replace(/\/[^/]*$/, '');
  self.__uv$config = {
    prefix:    B + '/uv/',
    bare:      B + '/bare/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler:   B + '/runtime/uv/uv.handler.js',
    client:    B + '/runtime/uv/uv.client.js',
    bundle:    B + '/runtime/uv/uv.bundle.js',
    config:    B + '/runtime/uv/uv.config.js',
    sw:        B + '/runtime/uv/uv.sw.js'
  };
})();
