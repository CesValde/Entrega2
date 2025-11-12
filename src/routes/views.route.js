import { Router } from 'express'

const route = Router()

// el get es del endpoint
route.get('/', (req, res) => {
   // el render --> es el handlebars
   res.render('realTimeProducts', {}) 
})

export default route