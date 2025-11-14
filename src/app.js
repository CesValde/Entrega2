/* 
    Entrega N° 2
    
    - Websockets
    crear una vista “realTimeProducts.handlebars”, la cual vivirá en el endpoint “/realtimeproducts” 
    en nuestro views router, ésta contendrá la misma lista de productos, sin embargo, 
    ésta trabajará con websockets.

    Al trabajar con websockets, cada vez que creemos un producto nuevo, o bien cada vez que eliminemos un 
    producto, se debe actualizar automáticamente en dicha vista la lista.

    - Consigna
    Configurar nuestro proyecto para que trabaje con Handlebars y websocket. 

    - Aspectos a incluir
    Configurar el servidor para integrar el motor de plantillas Handlebars e instalar un servidor de socket.io al mismo.
    Crear una vista “home.handlebars” la cual contenga una lista de todos los productos agregados hasta el momento

    - Sugerencias
    Ya que la conexión entre una consulta HTTP y websocket no está contemplada dentro de la clase. Se recomienda que, 
    para la creación y eliminación de un producto, Se cree un formulario simple en la vista realTimeProducts.handlebars. 
    Para que el contenido se envíe desde websockets y no HTTP. Sin embargo, esta no es la mejor solución, leer el siguiente punto.

    Si se desea hacer la conexión de socket emits con HTTP, deberás buscar la forma de utilizar el servidor io de Sockets dentro 
    de la petición POST. ¿Cómo utilizarás un emit dentro del POST?
*/
import express from 'express'
import { ProductManager } from './ProductManager.js'
import { CartManager } from './CartManager.js'
import realTimeProducts from './routes/views.route.js'

// express-handlebars
import handlebars from 'express-handlebars'
import path from 'path'
import { fileURLToPath } from 'url'

// socket io
import { Server } from 'socket.io'
import http from 'http'

// filename toma el directorio del archivo ej: C:\Entrega2\src\app.js
// dirname toma la carpeta del directorio del archivo ej: C:\proyectos\miapp\src
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// servidor express
const app = express()
const server = http.createServer(app)
const io = new Server(server)
const PORT = 8080 

// Configuración de Handlebars
app.engine('handlebars', handlebars.engine())       // define cómo procesar los .handlebars
app.set('view engine', 'handlebars')                // define qué motor usar, en este caso handlebars
app.set('views', path.join(__dirname, 'views'))     // define dónde están las vistas

// Servir archivos estáticos (como JS, CSS, imágenes, etc.)
app.use(express.static(path.join(__dirname, 'public')))

// Manejo de ProductManager
const pathProduct = path.join(__dirname, 'json', 'products.json')
const productManager = new ProductManager(pathProduct)
let products = productManager.getInstance()

// Manejo de CartManager
const pathCarts = path.join(__dirname, 'json', 'carts.json')
const cartManager = new CartManager(pathCarts, productManager)
let carts = cartManager.getInstance()

// middleware para poder trabajar con datos JSON
app.use(express.json())

// iniciar el servidor 
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto http://localhost:${PORT}`)
})

// ruta principal 
app.get('/', (req, res) => {
    res.send("Bienvenido!")
})

// lista todos los productos de la base de datos.
app.get('/api/products/', (req, res) => {
    products = productManager.getProducts()
    res.json({ payload: products })
})

// busca un producto por id
app.get('/api/products/:pid', (req, res) => {
    const result = productManager.getProductById(req.params.pid)
    
    if(result.error) return res.status(404).json({ message: result.message, })
        res.status(201).json({ message: result.message, product: result.product })
})

// Debe agregar un nuevo producto con los siguientes campos:
// id: Number/String (No se manda desde el body, se autogenera para asegurar que nunca se repitan los ids).
// emite la lista de productos actualizada a los usuarios en linea
app.post("/api/products/", (req, res) => {
    const result = productManager.addProduct(req.body)

    if(result.error) return res.status(400).json({ message: result.message, missing: result.missingFields, invalid: result.invalidFields })
        res.status(201).json({ message: result.message, product: result.product })
        io.emit('lista_productos', products)
})

// Debe actualizar un producto por los campos enviados desde el body.  
// No se debe actualizar ni eliminar el id al momento de hacer la actualización.
// emite la lista de productos actualizada a los usuarios en linea
app.put("/api/products/:pid", (req, res) => {
    const id = req.params.pid               // el id del producto desde la URL
    const updates = req.body                // los campos que vienen en el body
    const result = productManager.modificarProducto(id, updates)

    if(result.error) return res.status(404).json({ message: result.message })
        res.status(200).json({ message: result.message, product: result.product })
        io.emit('lista_productos', products)
})

// Debe eliminar el producto con el pid indicado.
// emite la lista de productos actualizada a los usuarios en linea
app.delete("/api/products/:pid", (req, res) => {
    const result = productManager.eliminarProducto(req.params.pid)

    if(result.error) return res.status(404).json({ message: result.message })
        res.status(200).json({ message: result.message, product: result.product })
        io.emit('lista_productos', products)
})

// ------------------
// Ruta carts
app.get('/carts', (req, res) => {
    carts = cartManager.getCarts()
    res.json({ payload: carts })
})

// Debe listar los productos que pertenecen al carrito con el cid proporcionado.
app.get('/api/carts/:cid', (req, res) => {
    const result = cartManager.getProductsCartById(req.params.cid)

    if(result.error) return res.status(400).json({ message: result.message })
        res.status(200).json({ message: result.message, cartProducts: result.cartProducts })
})

// Debe crear un nuevo carrito con la siguiente estructura:
// id: Number/String (Autogenerado para asegurar que nunca se dupliquen los ids).
// products: Array que contendrá objetos que representen cada producto.
app.post('/api/carts/', (req, res) => {
    const result = cartManager.createCart(req.body)

    if(result.error) return res.status(400).json({ message: result.message })
        res.status(201).json({ message: result.message, cart: result.cart })
})

/* 
Debe agregar el producto al arreglo products del carrito seleccionado, utilizando el siguiente formato:
product: Solo debe contener el ID del producto.
quantity: Debe contener el número de ejemplares de dicho producto (se agregará de uno en uno).
Si un producto ya existente intenta agregarse, se debe incrementar el campo quantity de dicho producto.
*/
app.post('/:cid/product/:pid', (req, res) => {
    const { cid, pid } = req.params
    const result = cartManager.addProductCart(cid, pid)

    if(result.error) return res.status(404).json({ message: result.message })
        res.status(200).json({ message: result.message, cart: result.cartProducts })
})

/* ------------------------- Entrega 2 ----------------------------------  */

// renderiza los productos en tiempo real
app.use('/realtimeproducts', realTimeProducts)

io.on('connection', (socket) => {
    // emitir la coleccion de productos a todos los sockets
    socket.emit('lista_productos', products)
})