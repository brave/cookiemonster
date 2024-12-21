const systemPrompt = `Your task is to identify the coordinates of cookie notices.

An overlay element is considered to be a "cookie consent notice" if it meets all of these criteria:
1. it explicitly notifies the user of the site's use of cookies or other storage technology, such as: "We use cookies...", "This site uses...", etc.
2. it offers the user choices for the usage of cookies on the site, such as: "Accept", "Reject", "Learn More", etc., or informs the user that their use of the site means they accept the usage of cookies.

Note: This definition does not include adult content notices or any other type of notice that is primarily focused on age verification or content restrictions. Cookie consent notices are specifically intended to inform users about the website's use of cookies and obtain their consent for such use.

Note: A cookie consent notice should specifically relate to the site's use of cookies or other storage technology that stores data on the user's device, such as HTTP cookies, local storage, or session storage. Requests for permission to access geolocation information, camera, microphone, etc., do not fall under this category.

Note: Do NOT classify a website header or footer as a "cookie consent notice". Website headers or footers may contain a list of links, possibly including a privacy policy, cookie policy, or terms of service document, but their primary purpose is navigational rather than informational.
`

export async function extract (page, { randomToken, openai }) {
  // Take a full page screenshot
  const screenshot = await page.screenshot({
    encoding: 'base64',
    fullPage: false // only take a screenshot of the viewport
  })

  // Get screenshot dimensions
  const dimensions = await page.evaluate(() => {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    }
  })

  // Check if dimensions exceed 1024x1024
  if (dimensions.width > 1024 || dimensions.height > 1024) {
    return null
  }

  // Prepare the vision API request
  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Screen resolution is ${dimensions.width}x${dimensions.height}. If the screenshot contains a "cookie consent notice" respond with only the x,y pixel coordinates of either the agree or decline button, return null if none found.`
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${screenshot}`
          }
        }
      ]
    }
  ]

  // Call the vision API
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || 'llama3.2-vision',
    messages,
    max_tokens: 4,
    temperature: 0
  })

  const content = response.choices[0].message.content.trim()

  // Parse coordinates from response
  let coordinates = null
  try {
    const match = content.match(/(\d+),\s*(\d+)/)
    if (match) {
      coordinates = match.slice(1).map(Number)
    }
  } catch (error) {
    console.error('Failed to parse coordinates from vision API response:', error)
    return null
  }

  if (!coordinates) {
    return null
  }

  // Get element at the coordinates
  const elementHandle = await page.evaluateHandle((coords) => {
    function findOutermostFixedContainer (element) {
      if (!element) return null

      // Collect all fixed/sticky positioned ancestors
      const fixedElements = []
      let current = element
      while (current) {
        const style = window.getComputedStyle(current)
        if (style.position === 'fixed' || style.position === 'sticky') {
          fixedElements.push(current)
        }
        current = current.parentElement
      }

      // If no fixed elements found, return the original element
      if (fixedElements.length === 0) {
        return element
      }

      // Find the outermost element (one that isn't contained by other fixed elements)
      for (let i = fixedElements.length - 1; i >= 0; i--) {
        let contained = false
        for (let j = 0; j < fixedElements.length; j++) {
          if (i !== j && fixedElements[j].contains(fixedElements[i])) {
            contained = true
            break
          }
        }
        if (!contained) {
          return fixedElements[i]
        }
      }

      // Fallback to the last fixed element if no uncontained element found
      return fixedElements[fixedElements.length - 1]
    }

    const [x, y] = coords
    const targetElement = document.elementFromPoint(x, y)
    const container = findOutermostFixedContainer(targetElement)
    return container ? [container] : [] // Return as array
  }, coordinates)

  return elementHandle
}
