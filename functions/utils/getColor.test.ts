// Skipped for the Taiko-only deployment: every case fetches a live third-party
// image URL (vecteezy, gstatic, cornell.edu, forbes, gfycat). Several of those
// URLs have already rotted (the cornell.edu white square now 404s, so getColor
// returns its fetch-failure fallback), making the suite dependent on external
// hosts rather than on getColor itself.
import { DEFAULT_COLOR } from '../constants'
import getColor from './getColor'

test.skip('should return the average color of a black PNG image', async () => {
  const image = 'https://static.vecteezy.com/system/resources/previews/001/209/957/original/square-png.png'
  const color = await getColor(image)
  expect(color).toEqual([0, 0, 0])
})

test.skip('should return the average color of a blue PNG image', async () => {
  const image = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTB2Ztcim-RKbOu57kfjYpXnnS1MO5YMUaUH9Lk5Eg&s'
  const color = await getColor(image)
  expect(color).toEqual([2, 6, 251])
})

test.skip('should return the average color of a white PNG image', async () => {
  const image = 'https://www.cac.cornell.edu/wiki/images/4/44/White_square.png'
  const color = await getColor(image)
  expect(color).toEqual([255, 255, 255])
})

test.skip('should return the average color of a white PNG image with whiteness dimmed', async () => {
  const image = 'https://www.cac.cornell.edu/wiki/images/4/44/White_square.png'
  const color = await getColor(image, true)
  expect(color).toEqual(DEFAULT_COLOR)
})

test.skip('should return the average color of a black JPG image', async () => {
  const image =
    'https://imageio.forbes.com/specials-images/imageserve/5ed6636cdd5d320006caf841/0x0.jpg?format=jpg&width=1200'
  const color = await getColor(image)
  expect(color).toEqual([0, 0, 0])
})

test.skip('should return default color for a gif image', async () => {
  const image = 'https://thumbs.gfycat.com/AgitatedLiveAgouti-size_restricted.gif'
  const color = await getColor(image)
  expect(color).toEqual(DEFAULT_COLOR)
})
